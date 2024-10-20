type Event_Map_With_Fallback<T> = T & Record<string, Event>;

type Event_Map<T extends EventTarget> =
    T extends MediaQueryList
        ? Event_Map_With_Fallback<MediaQueryListEventMap>
    : T extends Document
        ? Event_Map_With_Fallback<DocumentEventMap>
    : T extends Window
        ? Event_Map_With_Fallback<WindowEventMap>
    : T extends HTMLElement
        ? Event_Map_With_Fallback<HTMLElementEventMap>
    : T extends SVGElement
        ? Event_Map_With_Fallback<SVGElementEventMap>
    : T extends MathMLElement
        ? Event_Map_With_Fallback<MathMLElementEventMap>
    : Event_Map_With_Fallback<GlobalEventHandlersEventMap>;

type Event_Types<T extends EventTarget> = keyof Event_Map<T> & string;
type Event_Value<
    T extends EventTarget,
    K extends Event_Types<T>
> = Event_Map<T>[K];