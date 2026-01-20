import "./globals.css";

export const metadata = {
  title: "Kevin",
  description: "Social match analytics dashboard MVP"
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
