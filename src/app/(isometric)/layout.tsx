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
