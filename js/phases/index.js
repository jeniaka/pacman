// ================= THE PHASE LIST =================
// Phase n is PHASES[n-1]. To add a phase: write js/phases/pN-name.js that exports a phase object
// (see js/phases/README.md for the fields), import it here and add it to the list.
import p1 from './p1-1980.js';
import p2 from './p2-mean-streets.js';
import p3 from './p3-hell-maze.js';
import p4 from './p4-jungle.js';
import p5 from './p5-land-grab.js';
let list=null;
// built lazily so phase modules can import main.js without an import-order problem
export function phases(){ return list||(list=[p1,p2,p3,p4,p5]); }
