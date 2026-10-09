import { t } from '../shared/i18n';
document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = t('ext_name');
import { createRoot } from 'react-dom/client';
import Popup from './Popup';

const root = document.getElementById('root')!;
createRoot(root).render(<Popup />);
