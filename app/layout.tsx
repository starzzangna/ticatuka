import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={
  title:'룬 다이스 — 세 줄의 운명',
  description:'실드와 알까기로 겨루는 전략 주사위 미니게임',
  openGraph:{title:'룬 다이스 — 세 줄의 운명',description:'실드와 알까기로 겨루는 전략 주사위 미니게임',images:[{url:'/og.png',width:1680,height:909,alt:'룬 다이스 — 세 줄의 운명'}]},
  twitter:{card:'summary_large_image',title:'룬 다이스 — 세 줄의 운명',description:'실드와 알까기로 겨루는 전략 주사위 미니게임',images:['/og.png']}
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
