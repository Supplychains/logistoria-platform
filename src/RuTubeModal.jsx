import React, { useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';

function toRutubeEmbed(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('rutube.ru') && u.pathname.startsWith('/video/')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const id = parts[1];
      if (id) {
        return { embedUrl: `https://rutube.ru/play/embed/${id}`, canEmbed: true };
      }
    }
    return { embedUrl: null, canEmbed: false };
  } catch {
    return { embedUrl: null, canEmbed: false };
  }
}

export default function RuTubeModal({ open, onClose, videoUrl }) {
  const [embedInfo, setEmbedInfo] = useState({ embedUrl: null, canEmbed: false });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      setFailed(false);
      return;
    }
    const info = toRutubeEmbed(videoUrl || '');
    setEmbedInfo(info);
    const t = setTimeout(() => setFailed(true), 5000);
    return () => clearTimeout(t);
  }, [open, videoUrl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-lg font-semibold">Просмотр видео</h3>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {embedInfo.canEmbed && !failed ? (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                title="RuTube player"
                src={embedInfo.embedUrl}
                className="absolute inset-0 w-full h-full rounded-lg border"
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                onLoad={() => setFailed(false)}
              />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">
                Не удалось встроить плеер или этот тип ссылки RuTube не поддерживает встраивание.
              </p>
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть на RuTube
                </a>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть на RuTube
            </a>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
