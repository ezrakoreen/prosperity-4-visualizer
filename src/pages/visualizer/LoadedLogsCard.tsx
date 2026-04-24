import { Group, Select, Stack, Text } from '@mantine/core';
import { Dropzone, FileRejection } from '@mantine/dropzone';
import { IconUpload } from '@tabler/icons-react';
import { ReactNode, useCallback, useState } from 'react';
import { ErrorAlert } from '../../components/ErrorAlert.tsx';
import { useAsync } from '../../hooks/use-async.ts';
import { ResultLog } from '../../models.ts';
import { useStore } from '../../store.ts';
import { parseAlgorithmLogs } from '../../utils/algorithm.tsx';
import { VisualizerCard } from './VisualizerCard.tsx';

function DropzoneContent(): ReactNode {
  return (
    <Group justify="center" gap="md" style={{ minHeight: 70, pointerEvents: 'none' }}>
      <IconUpload size={32} />
      <Text size="sm">Drop one or more log files here, or click to select them</Text>
    </Group>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      resolve(reader.result as string);
    });

    reader.addEventListener('error', () => {
      reject(new Error(`Could not read ${file.name}`));
    });

    reader.readAsText(file);
  });
}

export function LoadedLogsCard(): ReactNode {
  const loadedAlgorithms = useStore(state => state.loadedAlgorithms);
  const activeAlgorithmId = useStore(state => state.activeAlgorithmId);
  const addAlgorithm = useStore(state => state.addAlgorithm);
  const setActiveAlgorithm = useStore(state => state.setActiveAlgorithm);

  const [error, setError] = useState<Error>();

  const onDrop = useAsync(async (files: File[]): Promise<void> => {
    setError(undefined);

    const results = await Promise.allSettled(
      files.map(async file => {
        const text = await readFileAsText(file);
        const resultLog = JSON.parse(text) as ResultLog;
        return {
          label: file.name,
          algorithm: parseAlgorithmLogs(resultLog),
        };
      }),
    );

    const errorMessages: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        addAlgorithm(result.value.algorithm, result.value.label);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        errorMessages.push(`${files[i].name}: ${reason}`);
      }
    }

    if (errorMessages.length > 0) {
      setError(new Error(errorMessages.join('\n')));
    }
  });

  const onReject = useCallback((rejections: FileRejection[]) => {
    const messages: string[] = [];

    for (const rejection of rejections) {
      const errorType = {
        'file-invalid-type': 'Invalid type, only log files are supported.',
        'file-too-large': 'File too large.',
        'file-too-small': 'File too small.',
        'too-many-files': 'Too many files.',
      }[rejection.errors[0].code]!;

      messages.push(`Could not load algorithm from ${rejection.file.name}: ${errorType}`);
    }

    setError(new Error(messages.join('\n')));
  }, []);

  return (
    <VisualizerCard>
      <Stack gap="sm">
        <Text fw={700}>Loaded Logs</Text>
        {(error || onDrop.error) && <ErrorAlert error={error ?? onDrop.error!} />}
        <Group align="flex-end" grow>
          <Select
            label="Active log"
            data={loadedAlgorithms.map(algorithm => ({
              value: algorithm.id,
              label: algorithm.label,
            }))}
            value={activeAlgorithmId}
            onChange={value => setActiveAlgorithm(value)}
            allowDeselect={false}
            searchable
          />
        </Group>
        <Dropzone onDrop={onDrop.call} onReject={onReject} multiple loading={onDrop.loading}>
          <Dropzone.Idle>
            <DropzoneContent />
          </Dropzone.Idle>
          <Dropzone.Accept>
            <DropzoneContent />
          </Dropzone.Accept>
        </Dropzone>
      </Stack>
    </VisualizerCard>
  );
}
