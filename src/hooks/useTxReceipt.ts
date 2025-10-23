import { createResource, type Accessor } from 'solid-js';
import { type PublicClient } from 'viem';

interface useTxReceiptProps {
  txHash: Accessor<string>;
  client: Accessor<PublicClient>;
}

export const useTxReceipt = ({ txHash, client }: useTxReceiptProps) => {
  const [txReceipt] = createResource(
    () => client(),
    async (client) => {
      if (!client) throw new Error('Client not found');
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash() as `0x${string}`,
      });
      return receipt;
    }
  );
  return txReceipt;
};
