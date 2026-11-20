'use strict';

// Editorial status is deliberately unverified until each entry has cited sources.
const SAINTS = [
  {id:'peter',nameZh:'圣彼得',nameFr:'Saint Pierre',nameIntl:'Saint Peter',tags:['钥匙','书','公鸡'],bio:'耶稣的使徒；传统图像常以钥匙表示他与天国之门的关联。',feast:'6月29日',historical:'早期基督教传统中的使徒。',legend:'钥匙等图像象征来自宗教传统，并非肖像证据。'},
  {id:'paul',nameZh:'圣保罗',nameFr:'Saint Paul',nameIntl:'Saint Paul',tags:['剑','书'],bio:'早期基督教传教者，图像中常持剑与书。',feast:'6月29日',historical:'其书信与传教活动见于早期基督教文献。',legend:'剑作为殉道象征的具体画法属于后世图像传统。'},
  {id:'denis',nameZh:'圣德尼',nameFr:'Saint Denis de Paris',nameIntl:'Saint Denis of Paris',tags:['手捧头颅','主教冠','棕榈枝'],bio:'与巴黎相关的殉道主教，常被画成手捧自己的头。',feast:'10月9日',historical:'巴黎地区早期主教及殉道传统仍需逐项核查。',legend:'殉道后捧头行走的情节属于圣徒传说。'},
  {id:'catherine-alexandria',nameZh:'亚历山大的圣凯瑟琳',nameFr:'Sainte Catherine d’Alexandrie',nameIntl:'Saint Catherine of Alexandria',tags:['轮子','剑','王冠','棕榈枝'],bio:'传统故事中的殉道者，轮子是她最常见的象征物。',feast:'11月25日',historical:'其生平缺少可独立核实的同时代记录。',legend:'辩论、轮刑等情节主要来自后世圣徒传说。'},
  {id:'george',nameZh:'圣乔治',nameFr:'Saint Georges',nameIntl:'Saint George',tags:['龙','长矛','马'],bio:'常被表现为骑马持矛击龙的圣人。',feast:'4月23日',historical:'殉道者的历史背景仍需核查。',legend:'屠龙故事属于后世流传的传奇。'},
  {id:'lawrence',nameZh:'圣劳伦斯',nameFr:'Saint Laurent',nameIntl:'Saint Lawrence',tags:['烤架','棕榈枝','书'],bio:'罗马教会的执事殉道者，常以烤架为象征。',feast:'8月10日',historical:'其执事及殉道身份见于早期教会传统。',legend:'烤架受刑的细节需与早期记载区分。'},
  {id:'sebastian',nameZh:'圣塞巴斯蒂安',nameFr:'Saint Sébastien',nameIntl:'Saint Sebastian',tags:['箭','树','棕榈枝'],bio:'通常被描绘为身中箭矢的殉道者。',feast:'1月20日',historical:'其殉道传统与罗马相关。',legend:'绑树受箭的完整情节来自后来的传记传统。'},
  {id:'barbara',nameZh:'圣芭芭拉',nameFr:'Sainte Barbe',nameIntl:'Saint Barbara',tags:['塔','圣杯','棕榈枝'],bio:'常与塔楼一同出现，塔有时画着三扇窗。',feast:'12月4日',historical:'其生平的历史证据仍需核查。',legend:'囚于塔中的故事属于圣徒传说。'},
  {id:'anthony-abbot',nameZh:'圣安东尼院长',nameFr:'Saint Antoine abbé',nameIntl:'Saint Anthony the Great',tags:['猪','T形手杖','铃铛','书'],bio:'埃及隐修传统中的人物，西方图像常配猪和T形手杖。',feast:'1月17日',historical:'其隐修生活见于早期基督教文献。',legend:'猪与铃铛等为后世西方图像传统。'},
  {id:'james-greater',nameZh:'大圣雅各',nameFr:'Saint Jacques le Majeur',nameIntl:'Saint James the Greater',tags:['扇贝壳','朝圣杖','帽子','书'],bio:'耶稣的使徒，后与圣地亚哥朝圣联系在一起。',feast:'7月25日',historical:'其使徒身份见于新约文献。',legend:'扇贝壳等朝圣装束来自后世的朝圣传统。'},
  {id:'martin-tours',nameZh:'图尔的圣马丁',nameFr:'Saint Martin de Tours',nameIntl:'Saint Martin of Tours',tags:['斗篷','马','乞者','主教冠'],bio:'以分斗篷给贫者的故事闻名，后来成为图尔主教。',feast:'11月11日',historical:'曾任图尔主教。',legend:'分斗篷的具体场景来自圣徒传记叙述。'},
  {id:'mary-magdalene',nameZh:'圣玛利亚·玛达肋纳',nameFr:'Sainte Marie-Madeleine',nameIntl:'Mary Magdalene',tags:['香膏瓶','长发','书'],bio:'耶稣的追随者，西方艺术常用香膏瓶表示。',feast:'7月22日',historical:'其在福音书中被提及。',legend:'长发和香膏瓶的某些解释融合了后世不同人物传统。'},
  {id:'john-evangelist',nameZh:'圣若望宗徒',nameFr:'Saint Jean l’Évangéliste',nameIntl:'Saint John the Evangelist',tags:['鹰','书','圣杯'],bio:'四位福音书作者之一的传统形象，以鹰为象征。',feast:'12月27日',historical:'作者身份及与其他同名人物的关系仍需核查。',legend:'鹰与圣杯是图像传统中的象征。'},
  {id:'luke',nameZh:'圣路加',nameFr:'Saint Luc',nameIntl:'Saint Luke',tags:['牛','书','画笔'],bio:'传统中的福音书作者，以牛为象征，有时被画成画家。',feast:'10月18日',historical:'《路加福音》的作者归属来自教会传统。',legend:'描绘圣母像的画家身份属于后世传统。'},
  {id:'mark',nameZh:'圣马尔谷',nameFr:'Saint Marc',nameIntl:'Saint Mark',tags:['狮子','书'],bio:'传统中的福音书作者，常伴有翼狮。',feast:'4月25日',historical:'《马尔谷福音》的作者归属来自教会传统。',legend:'翼狮属于四福音书作者的图像象征。'},
  {id:'matthew',nameZh:'圣玛窦',nameFr:'Saint Matthieu',nameIntl:'Saint Matthew',tags:['天使','书'],bio:'传统中的福音书作者，常伴有人形有翼者。',feast:'9月21日',historical:'其使徒及作者身份的关系需核查。',legend:'有翼人物属于福音书作者的图像象征。'},
  {id:'agnes',nameZh:'圣依搦斯',nameFr:'Sainte Agnès',nameIntl:'Saint Agnes',tags:['羔羊','棕榈枝'],bio:'罗马的年轻殉道者，常与羔羊一同出现。',feast:'1月21日',historical:'其殉道纪念有早期教会传统。',legend:'羔羊形象与姓名谐音及后世象征有关。'},
  {id:'roch',nameZh:'圣罗克',nameFr:'Saint Roch',nameIntl:'Saint Roch',tags:['狗','腿部伤口','朝圣杖'],bio:'朝圣者形象，常露出腿部伤口并有狗相伴。',feast:'8月16日',historical:'其具体生平及年代仍需核查。',legend:'狗送食物等情节见于圣徒传说。'},
  {id:'christopher',nameZh:'圣克里斯多福',nameFr:'Saint Christophe',nameIntl:'Saint Christopher',tags:['孩子','手杖','河流'],bio:'传统中背负圣婴渡河的圣人。',feast:'7月25日',historical:'其生平的历史依据仍需核查。',legend:'背负圣婴渡河是著名的后世传说。'},
  {id:'cecilia',nameZh:'圣则济利亚',nameFr:'Sainte Cécile',nameIntl:'Saint Cecilia',tags:['管风琴','乐器','棕榈枝'],bio:'音乐家的主保圣人，常配管风琴等乐器。',feast:'11月22日',historical:'其罗马殉道传统仍需核查。',legend:'与乐器相伴的形象是后来的艺术传统。'},
  {id:'stephen',nameZh:'圣斯德望',nameFr:'Saint Étienne',nameIntl:'Saint Stephen',tags:['石头','棕榈枝','书'],bio:'《宗徒大事录》中的早期殉道者，常以石头为象征。',feast:'12月26日',historical:'其事迹记于《宗徒大事录》。',legend:'后世图像细节不等同于事件的独立史证。'},
  {id:'francis-assisi',nameZh:'亚西西的圣方济各',nameFr:'Saint François d’Assise',nameIntl:'Saint Francis of Assisi',tags:['鸟','圣痕','方济各会会衣'],bio:'方济各会的创立者，常穿会衣并带圣痕。',feast:'10月4日',historical:'其创立修会及生平有中世纪文献记录。',legend:'向鸟布道等场景应与可核查生平分开阅读。'},
  {id:'dominic',nameZh:'圣道明',nameFr:'Saint Dominique',nameIntl:'Saint Dominic',tags:['狗','火炬','星','书'],bio:'道明会创立者，图像中可能出现狗、火炬或星。',feast:'8月8日',historical:'其创立宣道会的活动有中世纪文献记录。',legend:'狗衔火炬等形象来自象征性传说。'},
  {id:'nicholas',nameZh:'圣尼古拉',nameFr:'Saint Nicolas',nameIntl:'Saint Nicholas of Myra',tags:['三个孩子','主教冠','三个金球'],bio:'米拉主教，常配三个孩子或三个金球。',feast:'12月6日',historical:'其主教身份的史料仍需核查。',legend:'拯救孩子及赠送黄金的情节属于圣徒传说。'}
].map(s => ({...s,verification:{status:'unverified',sources:[]}}));

if (typeof module !== 'undefined') module.exports = SAINTS;
