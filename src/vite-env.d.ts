/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Mapbox public token (pk.*) for place name-search. Optional — search disables itself if unset. */
  readonly VITE_MAPBOX_TOKEN?: string
}
