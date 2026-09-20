/**
 * Cloudinary (unsigned) upload configuration.
 *
 * The cloud name and upload preset were previously hard-coded in the
 * offer pages. They are now read from environment variables so the same
 * codebase can target different Cloudinary accounts.
 */
export const CLOUDINARY_CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";

export const CLOUDINARY_UPLOAD_PRESET =
  process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
