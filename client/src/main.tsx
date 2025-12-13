import React from 'react'
import ReactDOM from 'react-dom' // 注意：不是 react-dom/client
import App from './App'
import { BrowserRouter } from 'react-router-dom'

// MobX 配置依然建议保留，防止 AMIS 内部冲突
import { configure } from 'mobx';
configure({ isolateGlobalState: true });

import 'amis/lib/themes/cxd.css';
import 'amis/lib/helper.css';
import 'amis/sdk/iconfont.css';
import 'font-awesome/css/font-awesome.css';
import './style.css'

// React 17 的挂载方式
ReactDOM.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById('root')
);