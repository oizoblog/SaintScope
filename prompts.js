'use strict';

// English visual descriptions for CLIP. Each cue describes an iconographic motif,
// not a verified observation about the user's photograph.
const SAINT_PROMPTS = [
  {id:'peter',prompts:[['A Christian apostle holding large keys and a book in religious art.','手持钥匙与书的使徒'],['A stained glass window showing Saint Peter with the keys of heaven.','彩窗中持天国钥匙的人物']]},
  {id:'paul',prompts:[['A bearded Christian apostle holding a sword and a book in a painting.','手持剑与书的使徒'],['A statue of Saint Paul with a long sword and a scroll.','持长剑与卷轴的雕像']]},
  {id:'denis',prompts:[['A bishop saint carrying his severed head in both hands in a church sculpture.','双手捧着自己头颅的主教'],['A stained glass window of a headless bishop holding his head.','手捧头颅的无头主教彩窗']]},
  {id:'catherine-alexandria',prompts:[['A female saint standing beside a spiked breaking wheel and holding a sword.','站在刑轮旁并持剑的女性圣人'],['A crowned woman martyr with a broken wheel in a stained glass window.','彩窗中带王冠与刑轮的女性殉道者']]},
  {id:'george',prompts:[['A mounted warrior saint thrusting a spear into a dragon.','骑马持矛刺龙的圣人'],['A church painting of Saint George fighting a dragon on horseback.','骑马与龙搏斗的宗教绘画']]},
  {id:'lawrence',prompts:[['A deacon saint holding a metal gridiron in a church painting.','手持烤架的执事'],['A statue of a Christian martyr with a rectangular grill.','与长方形烤架相伴的殉道者雕像']]},
  {id:'sebastian',prompts:[['A nearly naked Christian martyr tied to a tree and pierced by arrows.','绑在树旁并身中箭矢的殉道者'],['A church statue of Saint Sebastian with arrows in his body.','身体被箭射中的圣人雕像']]},
  {id:'barbara',prompts:[['A female saint holding a small tower with three windows.','手持三窗塔楼的女性圣人'],['A stained glass woman martyr standing beside a tower and holding a chalice.','塔楼与圣杯旁的女性殉道者']]},
  {id:'anthony-abbot',prompts:[['An elderly monk saint with a pig, bell, and tau shaped staff.','带猪、铃铛与T形手杖的年长修士'],['A church statue of a bearded hermit with a pig at his feet.','脚边有猪的蓄须隐修士雕像']]},
  {id:'james-greater',prompts:[['A pilgrim apostle wearing a scallop shell and holding a walking staff.','戴扇贝壳并持朝圣杖的使徒'],['A statue of Saint James in a pilgrim hat decorated with shells.','帽上饰有贝壳的朝圣者雕像']]},
  {id:'martin-tours',prompts:[['A soldier on horseback cutting his cloak to share with a beggar.','骑马分斗篷给乞者的士兵'],['A stained glass bishop Saint Martin sharing his cloak with a poor man.','向贫者分享斗篷的圣马丁彩窗']]},
  {id:'mary-magdalene',prompts:[['A woman saint with long hair holding a jar of ointment.','长发并持香膏瓶的女性圣人'],['A religious painting of Mary Magdalene holding a perfume vessel.','手持香膏器皿的宗教绘画人物']]},
  {id:'john-evangelist',prompts:[['A young evangelist saint writing a book beside an eagle.','与鹰相伴并写书的年轻福音书作者'],['A stained glass Saint John with an eagle and a chalice.','带鹰与圣杯的彩窗人物']]},
  {id:'luke',prompts:[['An evangelist saint writing a gospel with an ox beside him.','与牛相伴写作的福音书作者'],['A painting of Saint Luke with a winged ox and a paintbrush.','带翼牛和画笔的人物绘画']]},
  {id:'mark',prompts:[['An evangelist saint writing a book beside a winged lion.','与翼狮相伴写书的福音书作者'],['A church mosaic of Saint Mark and a winged lion.','圣马尔谷与翼狮的教堂镶嵌画']]},
  {id:'matthew',prompts:[['An evangelist writing a book while an angel stands beside him.','天使陪伴下写书的福音书作者'],['A church painting of Saint Matthew with a winged human figure.','与有翼人形相伴的宗教绘画人物']]},
  {id:'agnes',prompts:[['A young woman martyr holding a lamb and a palm branch.','手抱羔羊并持棕榈枝的年轻殉道者'],['A stained glass Saint Agnes with a small white lamb.','彩窗中与白色羔羊相伴的圣人']]},
  {id:'roch',prompts:[['A pilgrim saint lifting his robe to show a wound on his thigh with a dog beside him.','露出腿部伤口且有狗相伴的朝圣者'],['A statue of Saint Roch with a walking stick, a dog, and a leg wound.','带手杖、狗和腿部伤口的雕像']]},
  {id:'christopher',prompts:[['A giant saint carrying a child on his shoulders while crossing a river.','肩负孩子渡河的巨人圣人'],['A church painting of Saint Christopher carrying the Christ child through water.','背负圣婴涉水的宗教绘画']]},
  {id:'cecilia',prompts:[['A female saint seated at a small pipe organ.','坐在小型管风琴旁的女性圣人'],['A church painting of Saint Cecilia playing a musical instrument.','演奏乐器的圣则济利亚绘画']]},
  {id:'stephen',prompts:[['A young deacon martyr holding stones and a palm branch.','手持石头与棕榈枝的年轻执事'],['A stained glass Saint Stephen with stones on his robe.','衣袍上有石头的圣斯德望彩窗']]},
  {id:'francis-assisi',prompts:[['A friar in a brown habit with birds gathered around him.','穿棕色会衣且有鸟相伴的修士'],['A church painting of Saint Francis showing the stigmata on his hands.','手上显露圣痕的方济各绘画']]},
  {id:'dominic',prompts:[['A friar in a black and white habit with a dog carrying a torch.','与衔火炬的狗相伴的黑白会衣修士'],['A church statue of Saint Dominic holding a book with a star above his head.','持书且头顶有星的圣道明雕像']]},
  {id:'nicholas',prompts:[['A bishop saint with three children standing in a wooden tub.','与木桶中三个孩子相伴的主教'],['A stained glass Saint Nicholas holding three golden balls.','手持三个金球的圣尼古拉彩窗']]}
];

if (typeof module !== 'undefined') module.exports = SAINT_PROMPTS;
