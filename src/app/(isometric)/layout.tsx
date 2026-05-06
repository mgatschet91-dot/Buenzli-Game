import localFont from 'next/font/local'

const volter = localFont({
  src: [
    { path: '../../../public/fonts/volter.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/volter_bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export default function IsometricRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={volter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, true);` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var ow=console.warn,oe=console.error;function isGT(a){if(!a||!a.length)return false;var s=a[0];return typeof s==='string'&&s.indexOf('@generaltranslation')>=0&&s.indexOf('could not locate translation')>=0;}console.warn=function(){if(isGT(arguments))return;return ow.apply(console,arguments);};console.error=function(){if(isGT(arguments))return;return oe.apply(console,arguments);};})();` }} />
      </head>
      <body style={{
        margin: 0, padding: 0,
        background: '#111520',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        WebkitFontSmoothing: 'none',
      }}>
        {children}
      </body>
    </html>
  )
}
