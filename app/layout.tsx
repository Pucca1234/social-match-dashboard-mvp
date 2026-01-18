import "./globals.css";

export const metadata = {
  title: "PLAB Dashboard Prototype",
  description: "Selection → query → result → drilldown prototype"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
