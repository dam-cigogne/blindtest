// Bibliothèque de morceaux par style. S(titre, artiste, passage, [autres titres], [autres artistes])
(function(){
function S(t,a,h,at,aa){return {t:t,a:a,h:h||"Refrain",at:at||[],aa:aa||[]};}
window.LIB = { themes: [
 { id:"s6070", title:"Années 60-70", label2:"Artiste", mult:1, songs:[
  S("Les Champs-Élysées","Joe Dassin","Refrain",["Aux Champs-Élysées","Aux Champs Elysees"],["Dassin"]),
  S("Dancing Queen","ABBA","Intro puis refrain"),
  S("Let It Be","The Beatles","Intro au piano",[],["Beatles"]),
  S("Hotel California","Eagles","Intro à la guitare",[],["The Eagles"]),
  S("Aline","Christophe","Refrain"),
  S("Satisfaction","The Rolling Stones","Intro (riff)",["(I Can't Get No) Satisfaction"],["Rolling Stones","Stones"]),
  S("Le Sud","Nino Ferrer","Refrain"),
  S("Stayin' Alive","Bee Gees","Intro",["Staying Alive"],["BeeGees"])
 ]},
 { id:"s80", title:"Années 80", label2:"Artiste", mult:1, songs:[
  S("Billie Jean","Michael Jackson","Intro (basse et batterie)",[],["MJ"]),
  S("Sweet Dreams (Are Made of This)","Eurythmics","Intro au synthé"),
  S("Voyage, voyage","Desireless","Refrain"),
  S("Africa","Toto","Refrain"),
  S("Les Démons de minuit","Images","Refrain",["Démons de minuit"]),
  S("Take On Me","a-ha","Refrain",[],["A ha","Aha"]),
  S("Girls Just Want to Have Fun","Cyndi Lauper","Refrain"),
  S("Don't Stop Believin'","Journey","Intro au piano",["Dont Stop Believing"])
 ]},
 { id:"s90", title:"Années 90", label2:"Artiste", mult:1, songs:[
  S("Wannabe","Spice Girls","Intro puis refrain"),
  S("Aïcha","Khaled","Refrain",["Aicha"]),
  S("Smells Like Teen Spirit","Nirvana","Intro (riff de guitare)",["Teen Spirit"]),
  S("Macarena","Los del Río","Refrain",[],["Los del Rio"]),
  S("Mambo No. 5","Lou Bega","Refrain",["Mambo Number 5","Mambo 5"]),
  S("Barbie Girl","Aqua","Refrain"),
  S("...Baby One More Time","Britney Spears","Intro (piano)",["Baby One More Time"]),
  S("Gangsta's Paradise","Coolio","Intro")
 ]},
 { id:"s00", title:"Années 2000", label2:"Artiste", mult:1, songs:[
  S("Hips Don't Lie","Shakira","Refrain",[],["Shakira Mebarak"]),
  S("Seven Nation Army","The White Stripes","Intro (riff)",["7 Nation Army"],["White Stripes"]),
  S("Toxic","Britney Spears","Intro (cordes)"),
  S("Alors on danse","Stromae","Refrain"),
  S("Dragostea Din Tei","O-Zone","Refrain",["Numa Numa","Dragostea din tei","Ma-ya-hi"],["OZone","O Zone"]),
  S("Crazy in Love","Beyoncé","Intro (cuivres)",[],["Beyonce"]),
  S("Mr. Brightside","The Killers","Intro (guitare)",["Mister Brightside"],["Killers"]),
  S("Lose Yourself","Eminem","Intro")
 ]},
 { id:"s10", title:"Années 2010 à aujourd'hui", label2:"Artiste", mult:1, songs:[
  S("Happy","Pharrell Williams","Refrain",[],["Pharrell"]),
  S("Papaoutai","Stromae","Refrain"),
  S("Uptown Funk","Mark Ronson feat. Bruno Mars","Intro puis refrain",[],["Bruno Mars","Mark Ronson"]),
  S("Shape of You","Ed Sheeran","Intro"),
  S("Flowers","Miley Cyrus","Refrain"),
  S("Rolling in the Deep","Adele","Refrain"),
  S("Blinding Lights","The Weeknd","Intro (synthé)",[],["Weeknd"]),
  S("Dernière danse","Indila","Refrain",["Derniere danse"])
 ]},
 { id:"film", title:"Dessins animés et films", label2:"Film ou dessin animé", mult:1, songs:[
  S("Libérée, délivrée","La Reine des neiges","Refrain",["Libérée délivrée","Let It Go"],["Frozen","Reine des neiges"]),
  S("Hakuna Matata","Le Roi Lion","Refrain",[],["Roi Lion","The Lion King","Lion King"]),
  S("Générique de Dragon Ball Z","Dragon Ball Z","Début du générique",["Dragon Ball Z","Dragon Ball","DBZ","Cha-La Head-Cha-La","Chala Head Chala","Générique Dragon Ball Z"],["Dragon Ball","DBZ"]),
  S("He's a Pirate","Pirates des Caraïbes","Intro",["Pirates des Caraïbes","Pirate des Caraïbes","Hes a Pirate","Pirates of the Caribbean"],["Pirate des Caraïbes","Pirates of the Caribbean","Klaus Badelt","Hans Zimmer"]),
  S("My Heart Will Go On","Titanic","Refrain",[],["Céline Dion","Celine Dion"]),
  S("Ghostbusters","SOS Fantômes","Refrain",["SOS Fantômes","Ghostbuster"],["Ghostbusters","Ghostbuster","Ray Parker Jr"]),
  S("Thème de Star Wars","Star Wars","Début du thème",["Star Wars","La Guerre des étoiles","Generique Star Wars"],["La Guerre des étoiles","John Williams"]),
  S("Il en faut peu pour être heureux","Le Livre de la jungle","Refrain",["Il en faut peu pour etre heureux","Les Bare Necessities"],["Livre de la jungle","The Jungle Book","Jungle Book"])
 ]},
 { id:"fr", title:"Variété française", label2:"Artiste", mult:1, songs:[
  S("La Bohème","Charles Aznavour","Refrain",["La Boheme"],["Aznavour"]),
  S("Allumer le feu","Johnny Hallyday","Refrain",[],["Johnny","Hallyday"]),
  S("Les Lacs du Connemara","Michel Sardou","Refrain",["Lacs du Connemara","Connemara"],["Sardou"]),
  S("Joe le taxi","Vanessa Paradis","Refrain",[],["Paradis"]),
  S("Je veux","ZAZ","Refrain",[],["Zaz"]),
  S("Foule sentimentale","Alain Souchon","Refrain",[],["Souchon"]),
  S("Je l'aime à mourir","Francis Cabrel","Refrain",["Je laime a mourir"],["Cabrel"]),
  S("Santiano","Hugues Aufray","Refrain",[],["Aufray"])
 ]},
 { id:"fete", title:"Tubes de fête", label2:"Artiste", mult:1, songs:[
  S("Y.M.C.A.","Village People","Refrain",["YMCA","Y M C A"]),
  S("I Will Survive","Gloria Gaynor","Intro puis refrain"),
  S("Gangnam Style","PSY","Refrain",[],["Psy"]),
  S("Sweet Caroline","Neil Diamond","Refrain"),
  S("Les Sardines","Patrick Sébastien","Refrain",["Sardines"],["Patrick Sebastien"]),
  S("September","Earth, Wind & Fire","Refrain",[],["Earth Wind and Fire","Earth Wind Fire"]),
  S("Don't Stop Me Now","Queen","Intro au piano",["Dont Stop Me Now"]),
  S("Cotton Eye Joe","Rednex","Intro",[],["Red nex"])
 ]}
]};
})();
