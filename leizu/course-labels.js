/*
 * Human-readable course labels for the intake summary.
 * IDs remain in the hidden form fields so the intake can be joined to the
 * curriculum catalogue without exposing internal codes to families.
 */
(function(root){
  root.LEIZU_COURSE_LABELS = Object.freeze({
    h1:'World History',
    h2:'Canadian History',
    h3:'Ancient Civilizations',
    h4:'Twentieth Century',
    h5:'History of Philosophy',
    e1:'OSSD English',
    e2:'IB English A',
    e3:'University admissions writing',
    e4:'Academic writing',
    e5:'Literary analysis',
    e6:'ESL Intensive',
    p1:'IB Theory of Knowledge',
    p2:'OSSD Philosophy',
    p3:'Logic and argument',
    p4:'Introduction to ethics',
    p5:'Continental philosophy',
    a1:'Critical Media Literacy',
    a2:'Reading and writing with the screen',
    a3:'Academic integrity in the screen age',
    s1:'OSSD Civics',
    s2:'OSSD Politics',
    s3:'World Issues',
    s4:'Equity and Social Justice',
    s5:'IB Global Politics'
  });
})(typeof window !== 'undefined' ? window : globalThis);
