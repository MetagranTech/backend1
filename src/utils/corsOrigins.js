const vercelAdminPreviewPattern =
    /^https:\/\/admin-panel-[a-z0-9-]+-step-in\.vercel\.app$/i;

const isAllowedOrigin = (origin, allowedOrigins) =>
    !origin
    || allowedOrigins.length === 0
    || allowedOrigins.includes(origin)
    || vercelAdminPreviewPattern.test(origin);

module.exports = { isAllowedOrigin };
