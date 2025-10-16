import { createSignal } from 'solid-js';
import { useConfig } from '../hooks/useConfig';
import { Input } from './Input';
import { Sha256 } from '@aws-crypto/sha256-browser';
import { useCurrentAppConf } from '../hooks/useAppConf';

export const BatchUploadForm = () => {
  const { config } = useConfig();
  const { refetch } = useCurrentAppConf();
  const [template, setTemplate] = createSignal('');
  const [fileHash, setFileHash] = createSignal('');
  const [primaryKey, setPrimaryKey] = createSignal('');
  const [deploymentName, setDeploymentName] = createSignal('');
  const [batchName, setBatchName] = createSignal('');
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [isUploading, setIsUploading] = createSignal(false);

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
      try {
        const hash = await calculateFileHash(file);
        setFileHash(hash);
        console.log('File hash calculated:', hash);
      } catch (error) {
        console.error('Error calculating file hash:', error);
        setFileHash('');
        alert('Error calculating file hash. Please try again.');
      }
    } else {
      setSelectedFile(null);
      setFileHash('');
    }
  };

  const handleSubmit = async (event: Event) => {
    event.preventDefault();

    if (!selectedFile()) {
      alert('Please select a CSV file');
      return;
    }

    if (!deploymentName()) {
      alert('Please enter Deployment Name');
      return;
    }

    if (!batchName()) {
      alert('Please enter Batch Name');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('template', template());
      formData.append('file_hash', fileHash());
      formData.append('primary_key', primaryKey());
      formData.append('file', selectedFile()!);

      const response = await fetch(
        `${config.baseUrl}/admin/upload/${config.currentAppId}/${deploymentName()}/${batchName()}`,
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
        // Reset form
        setTemplate('');
        setFileHash('');
        setPrimaryKey('');
        setDeploymentName('');
        setBatchName('');
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        refetch();
      } else {
        const error = await response.text();
        console.error('Upload failed:', error);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div class="bg-white p-6 rounded-lg shadow-md">
      <h2 class="text-xl font-bold mb-6">Batch CSV Upload</h2>

      <form onSubmit={handleSubmit} class="space-y-4">
        <Input key="template" label="Template" value={() => template()} onChange={setTemplate} />

        <Input
          key="primary-key"
          label="Primary Key"
          value={() => primaryKey()}
          onChange={setPrimaryKey}
        />

        <Input
          key="deployment-name"
          label="Deployment Name"
          value={() => deploymentName()}
          onChange={setDeploymentName}
        />

        <Input
          key="batch-name"
          label="Batch Name"
          value={() => batchName()}
          onChange={setBatchName}
        />

        <div class="relative mt-6">
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            required
            class="
                          peer 
                          block 
                          w-full 
                          rounded-md 
                          border 
                          border-gray-300 
                          bg-transparent 
                          px-3 
                          pt-2 
                          pb-2
                          text-sm 
                          text-gray-900 
                          focus:border-blue-500 
                          focus:outline-none
                          file:mr-4 
                          file:py-2 
                          file:px-4 
                          file:rounded-md 
                          file:border-0 
                          file:text-sm 
                          file:font-medium 
                          file:bg-blue-50 
                          file:text-blue-700 
                          hover:file:bg-blue-100
                        "
          />
          <label
            for="csv-file"
            class="absolute left-3 top-0 text-gray-500 text-sm transition-all duration-200 -translate-y-2.5 bg-gray-100 px-1
                               peer-focus:top-0 peer-focus:text-sm peer-focus:text-blue-500"
          >
            CSV File
          </label>
          {selectedFile() && (
            <p class="mt-2 text-sm text-gray-600">
              Selected: {selectedFile()!.name} ({(selectedFile()!.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {fileHash() && (
          <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            Hash calculated: {fileHash()}
          </div>
        )}

        <div class="flex justify-end">
          <button
            type="submit"
            disabled={isUploading()}
            class="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isUploading() ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>
      </form>
    </div>
  );
};
