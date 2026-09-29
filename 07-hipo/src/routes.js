// A good run of each level, for the bot (see bot.js for the step language).
export const ROUTES = {
  chapoteo: [
    'R ground&y<11.01',          // onto the curb: any hiccup does it
    'R x>13.6',
    'RH k>=1',                   // hold one against the kickboards…
    'R air',                     // …and let it go
    'R ground&y<9.01',
    '. hic',                     // a hiccup on top reaches the stick
    '. ground',
    'R x>22.9',                  // the cold shower: an instant hiccup, and the stick under it
    'R x>28.2',
    '. ground&y<10.01',
    '. ground&y<9.01',
    '. ground&y<8.01',
    'R x>31.3',
    '.H k>=1',
    '. air',
    '. ground',
    'RH dive',                   // tiptoe off the edge holding it in
    '.H end',
  ],
  tumbonas: [
    'R x>6.3',
    '. ground&y<22.01',          // a hiccup up onto the sunbed
    'R x>9.3',
    '.H k>=1',
    'R air',                     // one bola from the sunbed clears the hedge
    'R ground&y<20.01',
    '. hic',
    '. ground',
    'R x>21.8',
    '. ground&y<22.01',          // the grandma's sunbed
    'R x>24.4',
    '.H k>=1',
    'R air',
    'R boing',                   // parasol 1
    '.H k>=1',
    '.H air&vy>-1&vy<1',         // let it go at the top of a bounce
    'R boing&x>29.5',            // parasol 2
    '.H k>=1',
    '.H air&vy>-1&vy<1',
    'R boing&x>33.5',            // parasol 3
    'R ground&y<17.01',          // the awning: towel, gaseosa
    'R x>41.4',
    'R ground&y<16.01',          // fizz makes the hiccups quick enough for the plastic chairs
    'R ground&y<15.01',
    'R ground&y<14.01',
    'R x>51.8',
    '.H k>=2',
    '. air',
    '. ground',
    'R x>55.2',
    'RH dive',
    '.H end',
  ],
  flotadores: [
    'R x>13.5',                  // onto the first float
    'RH gx>2.9',
    'RH wet',                    // off its end holding the breath: without it the hiccups bob it back up
    '.H ground',                 // down to the bottom…
    'LH stick',                  // …for the stick
    'L air',                     // let go: a big slow underwater hop
    'L ground',                  // onto the steps
    'L ground&y<24.01',
    'R ground&y<23.1',           // and out, straight onto the float
    'R gx>2.2',
    '. hic',
    'R ground',                  // float 2
    'R gx>1.2',
    '.H k>=1',
    '. air',                     // one bola under the stick
    '. ground',
    'R gx>2.4',
    '.H k>=1',
    '.H p2<22.2',                // wait for float 3 to swing close
    'R air',
    'R ground',
    'R gx>2.4',
    '.H k>=1',
    '.H p2>24',                  // floats 3 and 4 close up
    'R air',
    'R ground',
    'R gx>2.4',
    '.H k>=1',
    '.H p3>31.4',
    'R air',
    'R susto',                   // the croc: a fright, a leap, and no hiccups for a while
    'R ground',                  // the lifeguard's footrest
    'R x>41.2',
    '.H k>=2',                   // the hiccups come back: keep two
    '. air',
    '. ground',                  // crossbar
    'LH x<40.6',
    '.H k>=2',
    'L air',
    'L ground',                  // the seat
    'L x<37.9',
    '.H k>=1',
    '. air',
    '. ground',
    'LH dive',
    '.H end',
  ],
  vestuarios: [
    '.H k>=1',
    '. air',                     // a bola from the bench: the first stick
    '. ground',
    'R x>12.3',                  // through the low passage breathing normally (small hops fit)
    '.H k>=2',                   // two kept at its mouth…
    'RH hic',                    // …and the cold shower makes three: the burst, clear of the ceiling
    'R ground',                  // onto the lockers
    '.H k>=1',
    'RH k>=2',                   // the tall shower adds the second
    'R air',
    'R ground',                  // B
    'R x>22.2',
    '.H k>=1',
    '. air',                     // stick
    '. ground',
    'L x<22.6',
    '.H k>=2',
    'L air',                     // two, then the tall shower at the top of the hop: a hiccup in mid-air
    'L ground',                  // C (towel)
    'L x<16.8',
    '.H k>=2',
    'RH hic',                    // into the shower holding two: the burst goes up through the hatch
    'R ground',                  // the roof
    'R x>26.3',
    '.H k>=1',
    '. air',                     // stick
    '. ground',
    'R x>32.5',
    'RH dive',
    '.H end',
  ],
  trampolines: [
    'L x<35.7',
    '.H k>=2',
    'L air',                     // a two off the deck: up onto the 1 m board
    'L x<33.6',
    '. land',                    // the bounces die out
    'L x<29.6',
    '.H k>=2',
    '.H hic',                    // the burst, ×1.3 off the board: first stick
    '.H board',
    '.H launch',
    '.H store',                  // one kept in the air…
    '.H board',
    '. launch',                  // …let go as it touches: the pump, up through the 3 m board
    '. land',                    // B2
    '.H k>=1',
    'RH air',                    // tiptoe off its end holding one…
    'RH board',
    '. launch',                  // …and let go on the 1 m board: all the way up, second stick
    '. stick',
    'L board',                   // back onto B2
    '. land',
    'L x<29.6',
    '.H k>=2',
    '.H hic',                    // the burst off B2: up through the walkway
    '. land',                    // D
    'R x>31.2',                  // towel
    'L x<30.3',                  // back to just outside the lifeguard's reach
    '.H k>=2',
    'LH whistleUp',              // two kept, tiptoe in: he raises the whistle
    '.H susto',                  // the scare, with two on top
    'L x<26.8',                  // third stick
    '. board|land',              // B3
    '. land',
    'L x<23.3',
    '.H susto',                  // the hiccup comes back, kept; he blows again: ×1.3 off the board
    'L land',                    // the platform
    'L x<11.5',
    'LH dive',
    '.H end',
  ],
  // the beginner's way: up the balcony, then down onto the board letting go as it touches
  'trampolines~learn': [
    'L x<35.7',
    '.H k>=2',
    'L air',
    'L x<33.6',
    '. land',
    'L x<28.6',
    '.H k>=2',
    'L air',                     // a two, ×1.3 off the board: onto the balcony
    'L ground',
    'L x<24.4',                  // towel
    '.H k>=1',
    'RH air',                    // walk off holding one…
    'RH board',
    '. launch',                  // …let go as it touches: up to the 3 m board
    '. land',
    'R x>29.4',
    '.H k>=2',
    '.H hic',
    '. land',                    // D
    'L x<29',                    // into the lifeguard's reach, breathing normally
    '. susto',
    'L x<26.5',
    '. board|land',
    '. land',
    'L x<23.3',
    '.H susto',
    'L land',
    'L x<11.5',
    'LH dive',
    '.H end',
  ],
  lade10: [
    '.H k>=2',
    '. air',                     // two off the deck: onto A
    '. land',
    'R x>4.8',
    '.H k>=2',
    '.H hic',                    // the burst, just beside the shower…
    '. vy>-4',
    'R cold',                    // …and into its spray near the top: one more, first stick
    'R land',                    // B
    'R x>10.2',                  // towel
    '.H k>=1',
    'RH air',                    // tiptoe off its end holding one…
    'RH board',
    '. launch',                  // …let go on the board: up through D
    '. land',
    '. st>0.46',
    'L whistle',                 // he blows as you reach the far end
    'L board',                   // drift all the way left: second stick, onto E
    '. land',
    'L x<7.4',
    '.H k>=2',
    '.H hic',                    // the burst ×1.3 off E
    'L land',                    // F
    'R x>5.6',
    '.H k>=2',
    '.H hic',
    'R x>9',
    '. land',                    // G, towel
    '.H k>=2',
    '.H hic',                    // a burst up through H…
    '. land',                    // …and down onto it
    '.H k>=2',
    '.H hic',                    // burst ×1.3 off H
    '.H board',
    '.H launch',
    '.H store',
    '.H board',
    '. launch',                  // one kept, let go on the board: over the lip
    '. vy>-3',
    'R land',                    // the 10 m platform
    'R x>29.2',
    '.H k>=1',
    'RH x>30.6',
    'R air',                     // let it go at the very edge: the last stick is out over the water
    'R dive',
    '.H end',
  ],
  'lade10~learn': [
    '.H k>=2',
    '. air',
    '. land',
    '.H k>=2',
    'RH hic',
    'R land',
    'R x>10.2',
    '.H k>=1',
    'RH air',
    'RH board',
    '. launch',
    '. land',
    '. st>0.46',
    'L whistle',
    'L board',
    '. land',
    'L x<7.4',
    '.H k>=2',
    '.H hic',
    'L land',
    'R x>5.6',
    '.H k>=2',
    '.H hic',
    'R x>9',
    '. land',
    '.H k>=2',
    '.H hic',
    '. land',
    '.H k>=2',
    '.H hic',
    '.H board',
    '.H launch',
    '.H store',
    '.H board',
    '. launch',
    '. vy>-3',
    'R land',
    'RH dive',
    '.H end',
  ],
};
