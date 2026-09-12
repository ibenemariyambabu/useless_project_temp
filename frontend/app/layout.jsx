import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "BlinkOS — Person-Aware Computer-Vision Operating System",
  description: "BlinkOS is a futuristic, person-aware computer-vision operating system that tracks, compares, and gamifies multi-person blinking in real time.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* MediaPipe Tasks Vision CDN */}
        <Script
          type="module"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
              window.FilesetResolver = FilesetResolver;
              window.FaceLandmarker = FaceLandmarker;
              window.dispatchEvent(new CustomEvent('mediapipe-ready'));
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
