import { t } from '../shared/i18n';
document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = t('options_title');
import { createRoot } from 'react-dom/client';
import Options from './Options';

const root = document.getElementById('root')!;
createRoot(root).render(<Options />);
