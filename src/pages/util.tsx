import {
  createMemo,
  createSignal,
  Show,
  onMount,
  createContext,
  JSX,
  useContext,
  Accessor,
} from 'solid-js';
import {
  address,
  appendTransactionMessageInstruction,
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  createSolanaRpc,
  createTransactionMessage,
  TransactionWithLifetime,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  SignatureBytes,
  signTransactionMessageWithSigners,
  Transaction,
  SignatureDictionary,
  signAndSendTransactionMessageWithSigners,
  TransactionMessageBytes,
  getBase58Encoder,
  getBase58Decoder,
  getTransactionEncoder,
  TransactionPartialSigner,
  TransactionSendingSigner,
  getBase64EncodedWireTransaction,
} from '@solana/kit';
import {
  fetchMaybeMint,
  findAssociatedTokenPda,
  getApproveCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import {
  estimateComputeUnitLimitFactory,
  getSetComputeUnitLimitInstruction,
} from '@solana-program/compute-budget';

const phantomSdkContext = createContext<{
  hasProvider: Accessor<boolean>;
  isConnected: Accessor<boolean>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  publicKey: Accessor<string | null>;
}>({
  hasProvider: () => false,
  isConnected: () => false,
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  publicKey: () => null,
});

declare global {
  interface Window {
    solana?: any;
  }
}

export default function Util() {
  const hasProvider = () => !!window.solana;
  const [isConnected, setIsConnected] = createSignal(false);
  const [publicKey, setPublicKey] = createSignal<string | null>(null);

  onMount(() => {
    if (hasProvider()) {
      setIsConnected(window.solana.isConnected);
      if (window.solana.isConnected) {
        setPublicKey(window.solana.publicKey?.toString() || null);
      }

      window.solana.on('accountChanged', (publicKey: any) => {
        if (publicKey) {
          setPublicKey(publicKey.toString());
          setIsConnected(true);
        } else {
          setPublicKey(null);
          setIsConnected(false);
        }
      });

      window.solana.on('disconnect', () => {
        setIsConnected(false);
        setPublicKey(null);
      });
    }
  });

  const connect = async () => {
    const response = await window.solana.connect();
    setIsConnected(true);
    setPublicKey(response.publicKey.toString());
  };

  const disconnect = async () => {
    await window.solana.disconnect();
    setIsConnected(false);
    setPublicKey(null);
  };

  return (
    <phantomSdkContext.Provider
      value={{ hasProvider, isConnected, connect, disconnect, publicKey }}
    >
      <SolanaApprovePanel />
    </phantomSdkContext.Provider>
  );
}

function SolanaApprovePanel() {
  const { hasProvider, isConnected, connect, disconnect, publicKey } =
    useContext(phantomSdkContext);
  const [rpc, setRpc] = createSignal<string>('https://api.devnet.solana.com');
  const [mint, setMint] = createSignal<string>('a7FBpnsWYvxZPQuFJDipDXEQL5gQYAvtU2nAWH1cHaq');
  const [distributor, setDistributor] = createSignal<string>(
    '8Nkh7C7VdKtDfRFBKRJkqbFA7xNA9cGn4Sbox2Zde219'
  );
  const [allowance, setAllowance] = createSignal<string>('1000000000');
  const [sig, setSig] = createSignal<string>('');

  const signer: () => TransactionPartialSigner | TransactionSendingSigner = () => ({
    get address() {
      return address(publicKey()!);
    },
    signAndSendTransactions: async (
      transactions: readonly (Transaction | (Transaction & TransactionWithLifetime))[]
    ) => {
      const response = await window.solana!.request({
        method: 'signAndSendTransaction',
        params: {
          message: getBase58Decoder().decode(getTransactionEncoder().encode(transactions[0])),
        },
      });
      console.log(response);
      return [getBase58Encoder().encode(response.signature)];
    },
    signTransactions: async (
      transactions: readonly (Transaction | (Transaction & TransactionWithLifetime))[]
    ) => {
      const response = await window.solana!.request({
        method: 'signTransaction',
        params: {
          message: getBase58Decoder().decode(getTransactionEncoder().encode(transactions[0])),
        },
      });
      console.log(response);
      return [
        {
          [address(publicKey()!)]: response.signatures[0],
        },
      ];
    },
  });

  const handleSubmit = async () => {
    const client = createSolanaRpc(rpc());
    const vault = signer();
    const vaultAta = await findAssociatedTokenPda({
      mint: address(mint()),
      owner: vault.address,
      tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
    });

    const mintAcount = await fetchMaybeMint(
      client!,
      address(mint())
    );
    if (!mintAcount.exists) {
      return;
    }
    const decimals = mintAcount.data.decimals;
    const { value: latestBlockhash } = await client.getLatestBlockhash().send();
    const estimateComputeUnitLimit = estimateComputeUnitLimitFactory({
      rpc: client,
    });
    const txMsg = pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(signer().address, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) =>
        appendTransactionMessageInstructions(
          [
            getCreateAssociatedTokenIdempotentInstruction({
              ata: vaultAta[0],
              owner: vault.address,
              mint: address(mint()),
              payer: vault,
            }),
            getApproveCheckedInstruction({
              source: vaultAta[0],
              delegate: address(distributor()),
              mint: address(mint()),
              owner: vault,
              amount: BigInt(allowance()),
              decimals: decimals,
            }),
          ],
          tx
        )
    );

    const computeUnitEstimate = await estimateComputeUnitLimit(txMsg);

    const txWithComputeUnitLimit = appendTransactionMessageInstruction(
      getSetComputeUnitLimitInstruction({ units: computeUnitEstimate }),
      txMsg
    );

    const sig = await signAndSendTransactionMessageWithSigners(txWithComputeUnitLimit);
    setSig(getBase58Decoder().decode(sig));
  };

  return (
    <div class="container mx-auto p-6">
      <div class="bg-white shadow-md rounded-lg p-6">
        <div class="grid grid-cols-1 gap-6">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label class="text-sm font-medium text-gray-900 md:text-right">RPC</label>
            <div class="md:col-span-3">
              <input
                type="text"
                value={rpc()}
                onInput={(e) => setRpc(e.currentTarget.value)}
                placeholder="Enter RPC address"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label class="text-sm font-medium text-gray-900 md:text-right">Mint</label>
            <div class="md:col-span-3">
              <input
                type="text"
                value={mint()}
                onInput={(e) => setMint(e.currentTarget.value)}
                placeholder="Enter Mint address"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label class="text-sm font-medium text-gray-900 md:text-right">Vault</label>
            <div class="md:col-span-3">
              <Show
                when={hasProvider() && isConnected()}
                fallback={
                  <button
                    class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    onClick={connect}
                  >
                    Connect
                  </button>
                }
              >
                <div>
                  <span>{publicKey()}</span>
                  <button
                    class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    onClick={disconnect}
                  >
                    Disconnect
                  </button>
                </div>
              </Show>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label class="text-sm font-medium text-gray-900 md:text-right">Distributor</label>
            <div class="md:col-span-3">
              <input
                type="text"
                value={distributor()}
                onInput={(e) => setDistributor(e.currentTarget.value)}
                placeholder="Enter Distributor address"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label class="text-sm font-medium text-gray-900 md:text-right">Allowance</label>
            <div class="md:col-span-3">
              <input
                type="text"
                value={allowance()}
                onInput={(e) => setAllowance(e.currentTarget.value)}
                placeholder="Enter Allowance value"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <label class="text-sm font-medium text-gray-900 md:text-right">Signature</label>
            <div class="md:col-span-3">
              <input
                type="text"
                value={sig()}
                onInput={(e) => setSig(e.currentTarget.value)}
                placeholder="Enter signature"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 flex space-x-4">
        <button
          class="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          onClick={handleSubmit}
        >
          Submit
        </button>
        <button
          class="px-6 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          onClick={() => {
            setRpc('');
            setMint('');
            setDistributor('');
            setAllowance('');
            setSig('');
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
