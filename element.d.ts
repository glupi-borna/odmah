import type { Hook_Data, Attrs_ } from "./odmah";

declare global {
    interface EventTarget {
        _odmah_hooks: Hook_Data[] | undefined;
    }

    interface Element {
        _attrs: Attrs_|undefined;
        _prev_attrs: Attrs_|undefined;
        _class: string;
        _prev_class: string;
        _style: string;
        _prev_style: string;
        _odmah_state: Record<string, any>|undefined;
    }
}
