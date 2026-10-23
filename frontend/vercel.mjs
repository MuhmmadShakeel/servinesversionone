const apiTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, '')

if (!apiTarget || !/^https?:\/\//.test(apiTarget)) {
  throw new Error('Set API_PROXY_TARGET to the backend URL in Vercel Environment Variables.')
}

export const config = {
  framework: 'vite',
  rewrites: [
    { source: '/v1/:path*', destination: `${apiTarget}/v1/:path*` },
    { source: '/((?!v1(?:/|$)|api(?:/|$)).*)', destination: '/index.html' },
  ],
}
