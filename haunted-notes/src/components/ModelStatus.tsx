import React, { useEffect, useState } from 'react';
import { readModelStatus } from '../lib/modelCache';
import type { ModelStatus as Status } from '../lib/offlineStatus';
import ModelStatusView from './ModelStatusView';

interface Props {
  /** Changes when the Whisper load state changes, so the status is re-read. */
  refreshKey: string;
}

const ModelStatus: React.FC<Props> = ({ refreshKey }) => {
  const [status, setStatus] = useState<Status>('unknown');

  useEffect(() => {
    let cancelled = false;
    readModelStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return <ModelStatusView status={status} />;
};

export default ModelStatus;
