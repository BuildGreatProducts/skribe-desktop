import { useSettingsStore } from '../../stores/settingsStore';
import { Button, Modal } from '../ui';

type ProjectWritingInstructionsProps = {
  open: boolean;
  folderPath: string | null;
  onClose: () => void;
};

export function ProjectWritingInstructions({
  open,
  folderPath,
  onClose,
}: ProjectWritingInstructionsProps) {
  const settings = useSettingsStore((state) => state.settings);
  const update = useSettingsStore((state) => state.update);
  const instructions = folderPath
    ? settings.ai.projectWritingInstructions?.[folderPath] ?? ''
    : '';
  const projectName = folderPath ? folderPath.split(/[\\/]/).filter(Boolean).pop() : null;

  function updateInstructions(value: string) {
    if (!folderPath) return;
    void update((current) => ({
      ...current,
      ai: {
        ...current.ai,
        projectWritingInstructions: {
          ...current.ai.projectWritingInstructions,
          [folderPath]: value,
        },
      },
    }));
  }

  function resetInstructions() {
    if (!folderPath) return;
    void update((current) => {
      const projectWritingInstructions = { ...current.ai.projectWritingInstructions };
      delete projectWritingInstructions[folderPath];
      return {
        ...current,
        ai: {
          ...current.ai,
          projectWritingInstructions,
        },
      };
    });
  }

  return (
    <Modal
      open={open && Boolean(folderPath)}
      title="Project writing instructions"
      onClose={onClose}
    >
      <label className="block text-sm text-ink-soft">
        {projectName ?? 'Open project'}
        <textarea
          value={instructions}
          rows={8}
          className="mt-2 min-h-[180px] w-full resize-y rounded-md border border-hairline bg-paper px-3 py-2 text-base leading-relaxed text-ink placeholder:text-chrome-text-soft focus:border-accent focus:outline-none"
          placeholder="Voice, vocabulary, pacing, structure, words to prefer or avoid"
          onChange={(event) => updateInstructions(event.target.value)}
        />
      </label>
      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="link" onClick={resetInstructions} disabled={!instructions}>
          Reset
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
