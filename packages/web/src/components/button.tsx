/* Adapted from Animate UI button, efeb96ffd7a3b7a4868667e4ac3c346620fb3044.
 * Copyright (c) 2025 Elliot Sutton. MIT + Commons Clause.
 * Full terms: packages/web/licenses/ANIMATE-UI.txt.
 * Rare UI style from the shared theme; no unused Slot or delayed actions.
 */
import {motion,useReducedMotion,type HTMLMotionProps} from 'motion/react';
export function Button({hoverScale=1,tapScale=.98,...props}:HTMLMotionProps<'button'>&{hoverScale?:number;tapScale?:number}) {
 const reduced=useReducedMotion();
 return <motion.button whileTap={reduced?undefined:{scale:tapScale}} whileHover={reduced?undefined:{scale:hoverScale}} transition={{duration:.12}} {...props}/>;
}
