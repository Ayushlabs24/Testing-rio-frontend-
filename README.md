This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Browser support (RIO-NFR-009)

The app targets modern evergreen browsers. The supported matrix is declared in
`package.json` (`browserslist`) and consumed by the build toolchain:

- **Chrome / Edge** (Chromium) — last 2 versions
- **Firefox** (Gecko) — last 2 versions
- **Safari** (WebKit, macOS/iOS) — last 2 versions

Cross-browser rendering is verified with Playwright across all three engines plus
mobile viewports (see `playwright.config.ts`):

```bash
npx playwright install chromium firefox webkit   # one-time
npm run test:e2e                                  # render specs on every engine
```

`e2e/browser-compat.spec.ts` loads each public page (login, OTP, forgot/reset
password, signup) on Chromium, Firefox, WebKit, Mobile Chrome (Pixel 7) and
Mobile Safari (iPhone 14) and asserts every page renders its heading and form
controls with no uncaught errors — satisfying the NFR-009 acceptance criterion
"no major rendering errors." These specs are backend-independent.

Full app-flow e2e (`auth-flows.spec.ts`) needs a running API with seeded
accounts; opt in with `E2E_BACKEND=1 npm run test:e2e`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
