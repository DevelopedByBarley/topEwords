import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/*
 * A ScrollTrigger alapból `resize`-ra újraméri az ÖSSZES triggert. A mobil
 * böngészők viszont pont görgetés közben dobnak `resize`-t, amikor az URL-sáv
 * be- vagy kicsúszik — így a landing ~25 triggere a görgetés első pillanatában
 * újraszámolódott, kényszerített layouttal. Az `ignoreMobileResize` a magasság
 * változását figyelmen kívül hagyja; a valódi orientációváltás továbbra is
 * frissít.
 */
ScrollTrigger.config({ ignoreMobileResize: true });

export { gsap, ScrollTrigger };
