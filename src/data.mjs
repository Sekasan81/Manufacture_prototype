export const RESOURCES = {
 copper:{name:'Медь',symbol:'Cu',color:'#c28f62'}, iron:{name:'Железо',symbol:'Fe',color:'#95a8a7'},
 steel:{name:'Сталь',symbol:'St',color:'#789db6'}, gold:{name:'Золото',symbol:'Au',color:'#d2ac41'},
 platinum:{name:'Платина',symbol:'Pt',color:'#bda3ce'}, titanium:{name:'Титан',symbol:'Ti',color:'#86afbb'},
 alloy:{name:'Космический сплав',symbol:'✧',color:'#97b96e'}
};
export const RESONANCES=[{name:'Шестерня',symbol:'⚙',color:'#be915b'},{name:'Молоток',symbol:'⚒',color:'#9180b5'},{name:'Молния',symbol:'ϟ',color:'#cdad42'},{name:'Лазер',symbol:'⌁',color:'#639bad'}];
export const ROLES={producer:{name:'Производитель',cycle:2,yield:1},assembler:{name:'Сборщик',cycle:3,amount:2,yield:1},crafter:{name:'Крафтер'},booster:{name:'Усилитель',effect:'doubleOutput'}};
export const SPECIES={
 copper:{name:'Производитель меди',short:'Медник',role:'producer',output:'copper',color:'#d1a169'},
 iron:{name:'Производитель железа',short:'Феррик',role:'producer',output:'iron',color:'#a7b7a1'},
 steel:{name:'Сборщик стали',short:'Феррит',role:'assembler',input:'iron',output:'steel',color:'#7aaabd'},
 gold:{name:'Производитель золота',short:'Аурум',role:'producer',output:'gold',color:'#dec15e'},
 booster:{name:'Усилитель',short:'Спарк',role:'booster',color:'#9fbd73'},
 platinum:{name:'Сборщик платины',short:'Платик',role:'assembler',input:'gold',output:'platinum',color:'#b8a1cc'},
 crafter:{name:'Крафтер',short:'Дирижёр',role:'crafter',color:'#b596cb'},
 titanium:{name:'Производитель титана',short:'Титаник',role:'producer',output:'titanium',color:'#83bac2'},
 alloy:{name:'Сборщик космического сплава',short:'Космик',role:'assembler',input:'titanium',output:'alloy',color:'#b5c57f'}
};
export const SHOP=[{species:'iron',cost:{copper:10}},{species:'steel',cost:{copper:10,iron:10}},{species:'gold',cost:{steel:10}},{species:'booster',cost:{gold:10}},{species:'platinum',cost:{steel:10,gold:10}},{species:'crafter',cost:{platinum:10}},{species:'titanium',cost:{platinum:10}},{species:'alloy',cost:{titanium:10}}];
export function definition(u){const d=SPECIES[u.species];return {...ROLES[d.role],...d};}
