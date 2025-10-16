import { createSignal, Show } from 'solid-js';
import { AppConf } from '../../hooks/useAppConf';
import { SetStoreFunction } from 'solid-js/store';
import { useConfig } from '../../hooks/useConfig';
import { Sha256 } from '@aws-crypto/sha256-browser';

interface UploadBatchStepProps {
  appConf: AppConf;
  setAppConf: SetStoreFunction<AppConf>;
  onSave?: () => Promise<boolean>;
  onRefetch?: () => void;
}

export default function UploadBatchStep(props: UploadBatchStepProps) {
  const { config } = useConfig();

  const [template, setTemplate] = createSignal('');
  const [fileHash, setFileHash] = createSignal('');
  const [primaryKey, setPrimaryKey] = createSignal('');
  const [batchName, setBatchName] = createSignal('');
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);
  const [uploadSuccess, setUploadSuccess] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);

  const calculateFileHash = async (file: File): Promise<string> => {
    const text = await file.text();
    const hasher = new Sha256();
    hasher.update(text);
    const result = await hasher.digest();
    return Array.from(result)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleFileChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
      try {
        const hash = await calculateFileHash(file);
        setFileHash(hash);
        console.log('File hash calculated:', hash);
      } catch (error) {
        console.error('Error calculating file hash:', error);
        setFileHash('');
        setUploadError('Error calculating file hash. Please try again.');
      }
    } else {
      setSelectedFile(null);
      setFileHash('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile()) {
      setUploadError('Please select a CSV file');
      return;
    }

    if (!batchName()) {
      setUploadError('Please enter Batch Name');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('template', template());
      formData.append('file_hash', fileHash());
      formData.append('primary_key', primaryKey());
      formData.append('file', selectedFile()!);

      // Updated URL: no deploymentName needed
      const response = await fetch(
        `${config.baseUrl}/admin/upload/${props.appConf.appId}/${batchName()}`,
        {
          method: 'POST',
          headers: {
            'x-api-key': config.apiKey,
          },
          body: formData,
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Upload successful:', result);
        setUploadSuccess(true);
        // Auto-hide success message after 3 seconds
        setTimeout(() => setUploadSuccess(false), 3000);

        // Refetch appConf to sync root data from remote
        if (props.onRefetch) {
          console.log('Refetching appConf to sync root data...');
          props.onRefetch();
        }

        // Reset form
        setTemplate('');
        setFileHash('');
        setPrimaryKey('');
        setBatchName('');
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('batch-csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const error = await response.text();
        console.error('Upload failed:', error);
        setUploadError(`Upload failed: ${error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const appRoot = () => props.appConf.extra.root;
  const hasRootData = () => appRoot() && Object.keys(appRoot()).length > 0;

  return (
    <div class="space-y-6">
      {/* Root Configuration Display */}
      <div>
        <h3 class="text-sm font-medium text-gray-700 mb-3">Root Configuration</h3>
        <Show
          when={hasRootData()}
          fallback={
            <div class="bg-gray-50 p-4 rounded-lg border border-gray-300 text-center">
              <p class="text-sm text-gray-500">No root configuration available</p>
              <p class="text-xs text-gray-400 mt-1">Root data will appear here after upload</p>
            </div>
          }
        >
          <div class="bg-white p-4 rounded-lg border border-gray-300">
            <div class="space-y-2">
              {Object.entries(appRoot()).map(([key, value]) => (
                <div class="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                  <span class="font-medium text-gray-700">{key}:</span>
                  <span class="text-gray-600 font-mono text-sm break-all">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </Show>
      </div>

      {/* Success Message */}
      <Show when={uploadSuccess()}>
        <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center gap-2 text-green-800">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="font-medium">Batch uploaded successfully!</span>
          </div>
        </div>
      </Show>

      {/* Error Message */}
      <Show when={uploadError()}>
        <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div class="flex items-center gap-2 text-red-800">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="text-sm">{uploadError()}</span>
          </div>
        </div>
      </Show>

      {/* Batch Name */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Batch Name <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={batchName()}
          onInput={(e) => setBatchName(e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g. airdrop-round-1"
          required
        />
        <p class="mt-1 text-xs text-gray-500">Unique identifier for this batch</p>
      </div>

      {/* Template (Optional) */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Template</label>
        <input
          type="text"
          value={template()}
          onInput={(e) => setTemplate(e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Template name (optional)"
        />
        <p class="mt-1 text-xs text-gray-500">Optional template identifier</p>
      </div>

      {/* Primary Key (Optional) */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Primary Key</label>
        <input
          type="text"
          value={primaryKey()}
          onInput={(e) => setPrimaryKey(e.currentTarget.value)}
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Primary key field (optional)"
        />
        <p class="mt-1 text-xs text-gray-500">Column name to use as primary key</p>
      </div>

      {/* File Upload */}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          CSV File <span class="text-red-500">*</span>
        </label>
        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-400 transition-colors">
          <input
            id="batch-csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            class="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-medium
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100
                            cursor-pointer"
          />
          <Show when={selectedFile()}>
            <div class="mt-3 p-3 bg-gray-50 rounded-lg">
              <p class="text-sm text-gray-700">
                <span class="font-medium">Selected:</span> {selectedFile()!.name}
              </p>
              <p class="text-xs text-gray-500 mt-1">
                Size: {(selectedFile()!.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </Show>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          Upload a CSV file with recipient addresses and amounts
        </p>
      </div>

      {/* File Hash Display */}
      <Show when={fileHash()}>
        <div class="p-3 bg-green-50 border border-green-200 rounded-lg">
          <p class="text-xs font-medium text-green-900 mb-1">File Hash (SHA-256):</p>
          <p class="text-xs text-green-700 font-mono break-all">{fileHash()}</p>
        </div>
      </Show>

      {/* Upload Button */}
      <div class="flex justify-end pt-4">
        <button
          onClick={handleUpload}
          disabled={!selectedFile() || !batchName() || isUploading()}
          class={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            !selectedFile() || !batchName() || isUploading()
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Show when={isUploading()}>
            <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </Show>
          {isUploading() ? 'Uploading...' : 'Upload Batch'}
        </button>
      </div>
    </div>
  );
}
