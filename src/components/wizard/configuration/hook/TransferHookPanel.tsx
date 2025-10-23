import HookPanelHeader from './HookPanelHeader';
import { BsArrowRight } from 'solid-icons/bs';

interface TransferHookPanelProps {
  proportion: string;
  isFallback: boolean;
}

export default function TransferHookPanel(props: TransferHookPanelProps) {
  return (
    <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 overflow-hidden">
      <HookPanelHeader
        icon={BsArrowRight}
        title="Transfer Hook"
        description="Direct token transfer to recipients"
        proportion={props.proportion}
        isFallback={props.isFallback}
        color="green"
      />
    </div>
  );
}
