// ⚠️ WORKAROUND : Next.js 14.2.35 nécessite ce _document.tsx pour collecter
// l'App Router. Sans lui, le build échoue sur PageNotFoundError: /_document.
// Voir : B.0.8.ui.2.debug (H6 confirmée).
// TODO: retirer quand Next.js est mis à jour (14.2.40+).
import Document, { Head, Html, Main, NextScript } from "next/document";

export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="fr">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}