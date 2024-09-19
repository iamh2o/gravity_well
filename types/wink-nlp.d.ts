// wink-nlp.d.ts
import 'wink-nlp';

declare module 'wink-nlp' {
    interface Document {
        nouns(): { out: (format: string) => { normal: string; frequency: number; }[] };
        entities(): { out: (format: string) => { normal: string; frequency: number; type?: string; }[] };
    }
}
