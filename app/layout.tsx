import "./globals.css"; // Baris ini yang paling penting!

export const metadata = {
  title: 'GasWizard - ETH Gas Tracker',
  description: 'Real-time Ethereum Gas Price Tracker',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}