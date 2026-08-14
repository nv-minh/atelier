// X/Twitter reads its own image convention rather than falling back to the
// Open Graph one, so the same card is re-exported here instead of drawn twice.
export { alt, size, contentType, default } from "./opengraph-image";
