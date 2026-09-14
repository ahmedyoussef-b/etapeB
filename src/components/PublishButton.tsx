'use client';

import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { publishToCloud, PublishFile } from '@/services/publisher';

type Status = 'idle' | 'scanning' | 'publishing' | 'done' | 'error';

export function PublishButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Écouter les changements de fichiers
    const unlisten = listen<string[]>('files-changed', (event) => {
      setPendingFiles((prev) => Array.from(new Set([...prev, ...event.payload])));
      setStatus('idle');
      setMessage(`${event.payload.length} fichier(s) modifié(s)`);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function handlePublish() {
    if (pendingFiles.length === 0) {
      setMessage('Aucun fichier à publier');
      return;
    }

    setStatus('publishing');
    setMessage('Publication en cours...');

    // Pour l'instant, on envoie juste les chemins
    // (le vrai contenu sera lu depuis .data/ dans une prochaine étape)
    const files: PublishFile[] = pendingFiles.map((path) => ({
      path,
      textContent: '(contenu à implémenter)',
      hash: 'placeholder',
      size: 0,
      version: 'v1',
    }));

    const result = await publishToCloud(files);

    if (result.success) {
      setStatus('done');
      setMessage(`${result.fileCount} fichier(s) publié(s) - ${result.version}`);
      setPendingFiles([]);
    } else {
      setStatus('error');
      setMessage(`Erreur: ${result.error}`);
    }
  }

  function handleStartWatcher() {
    setStatus('scanning');
    setMessage('Démarrage du watcher...');
    
    invoke<string>('get_user_data_path')
      .then((path) => invoke('start_file_watcher', { path: `${path}/repository` }))
      .then(() => {
        setStatus('idle');
        setMessage('Watcher démarré');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(`Erreur watcher: ${error}`);
      });
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border z-50">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-gray-900">Publication</span>
        <span className={`w-2 h-2 rounded-full ${
          status === 'error' ? 'bg-red-500' :
          status === 'publishing' ? 'bg-yellow-500' :
          status === 'done' ? 'bg-green-500' :
          'bg-gray-400'
        }`} />
      </div>
      
      <div className="text-sm text-gray-600 mb-2">{message || 'Prêt'}</div>
      
      {pendingFiles.length > 0 && (
        <div className="text-xs text-gray-500 mb-2">
          {pendingFiles.length} fichier(s) en attente
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          onClick={handleStartWatcher}
          disabled={status === 'publishing'}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
        >
          Démarrer
        </button>
        <button
          onClick={handlePublish}
          disabled={status === 'publishing' || pendingFiles.length === 0}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Publier
        </button>
      </div>
    </div>
  );
}
