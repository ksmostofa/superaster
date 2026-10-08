// SPDX-License-Identifier: Apache-2.0
import { listPresets } from '../../../catalog/src/index.js';
import type { Preset } from '../../../catalog/src/types.js';
import { Button as RareButton } from './button.js';

export interface CatalogPageProps {
  onSelectPreset: (id: string) => void;
}

function downloadPreset(preset: Preset): void {
  const bytes = new Blob([JSON.stringify(preset, null, 2) + '\n'], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(bytes);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${preset.id}@${preset.version}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function CatalogPage({ onSelectPreset }: CatalogPageProps) {
  return (
    <main className="catalog">
      <p className="eyebrow">Source → permitted recipe → checked output</p>
      <h1>Prepare for a destination.</h1>
      <p>
        Each profile names its authority and channel. File checks cannot guarantee
        official acceptance.
      </p>
      <p>
        Source dates record the last review. Rules can change, so check the
        submitting authority's current instructions. Unspecified editing
        permission requires review before changing an official photo.
      </p>
      <div className="preset-list">
        {listPresets().map((preset) => (
          <article key={`${preset.id}@${preset.version}`}>
            <div>
              <h2>{preset.purpose}</h2>
              <p>
                {preset.authority} · {preset.channel} · {preset.jurisdiction}
              </p>
              <small>
                {preset.id} @ {preset.version} · {preset.freshness.status}{' '}
                {preset.freshness.verified_at}
              </small>
            </div>
            <div>
              <p>{preset.edit_policy.notes}</p>
              {preset.sources.map((source) => (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  key={source.url}
                >
                  {source.title}
                </a>
              ))}
              <RareButton
                type="button"
                className="secondary"
                onClick={() => onSelectPreset(preset.id)}
              >
                Use profile
              </RareButton>
              <RareButton
                type="button"
                className="text-button"
                onClick={() => downloadPreset(preset)}
              >
                Download JSON
              </RareButton>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
