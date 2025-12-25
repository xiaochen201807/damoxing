import ReactDOM from 'react-dom' // 注意：不是 react-dom/client
import App from './App'

// MobX 配置依然建议保留，防止 AMIS 内部冲突
import { configure } from 'mobx';
configure({ isolateGlobalState: true });

import 'amis/lib/themes/cxd.css';
import 'amis/lib/helper.css';
import 'amis/sdk/iconfont.css';
import 'font-awesome/css/font-awesome.css';
import './style.css'
import './index.css'

// React 17 的挂载方式
// 注意：BrowserRouter 已在 App.tsx 中配置
ReactDOM.render(
  <App />,
  document.getElementById('root')
);