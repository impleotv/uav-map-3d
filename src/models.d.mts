import type {PresentationModel, PresentationPreset, PresentationDraft} from "./modelTypes.js";
export declare const presentationPresets: Readonly<Record<PresentationPreset,string>>;
export declare const presentationDefaults: Readonly<PresentationModel>;
export declare function presentationName(config: Partial<PresentationModel> | null | undefined, fallback: string): string;
export declare function resolvePresentation(...layers: (Partial<PresentationModel> | null | undefined)[]): PresentationModel;
export declare function presentationError(value: PresentationDraft): string;
export declare function modelUrl(config: Pick<PresentationModel,"preset"|"url">, assetBaseUrl: string): string;
