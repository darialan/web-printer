import { useLocale } from '../ui/locale';
import './long-article.css';

export const LONG_ARTICLE_CONTENT_ID = 'print-content-long-article';

const sectionsZh = [
  {
    title: '从家门口开始',
    paragraphs: [
      '我第一次认真走完住处附近的那条河，是在一个没有安排的周六。原本只是想去买早餐，出门时发现天气很好，便沿着河岸多走了一站。平时坐在公交车里，这段路只是一排快速向后移动的树；真正走进去，才发现树后面还藏着一条更低的小路，早晨的光从栏杆缝里落在水面上。',
      '河边有一间很早开门的杂货铺。店主把纸箱搬到门口，顺手给花盆浇水，水顺着台阶流下去，在地面上留出一道颜色稍深的痕迹。这样的事情每天都在发生，我此前却从来没有看见。不是它离我太远，而是每次经过时，我都在忙着抵达另一个地方。',
      '出门前我以为自己很熟悉这里：知道最近的地铁入口，知道哪家便利店可以取快递，也知道晚高峰时应该在哪个路口提前换道。但这些认识更像是一份任务清单，能帮助我完成事情，却不能告诉我这个街区在一天之中怎样变化，又有哪些人一直在这里生活。',
      '走到桥下时，我遇见一个带孩子练习骑车的父亲。孩子每次经过石柱都会停下来，伸手碰一下柱子上的旧标记，再重新上车。父亲并不催促，只在后面慢慢跟着。我原本准备从他们身边快速绕过，后来也放慢了脚步，在桥下站了一会儿，听自行车铃声和河水的回响。',
      '那天最后并没有走很远。回到家时，早餐已经有些凉了，手机里的步数也算不上特别多。我却觉得这段路比平时任何一次通勤都长，因为一路上有许多可以记住的片刻，彼此之间还留着空隙。它们不需要被拍成照片，也没有必须讲给谁听的理由。',
    ],
  },
  {
    title: '一条路的不同时间',
    paragraphs: [
      '后来我开始在不同时间走同一段河岸。清晨的路面还有清洁车留下的水迹，午后的长椅大多空着，到了傍晚，遛狗的人、跑步的人和推婴儿车的人又把这里填满。地图上的线没有改变，实际走过的却像是几条不同的路，每一条都有自己的声音和速度。',
      '有一段坡道旁种着桂花。第一次闻到香气时，我以为是附近有人在晾晒衣服，走过两次才找到气味的来源。花开得很小，藏在叶片之间，远远看去几乎没有变化。后来每次经过，我都习惯性地往那边靠一点，想知道今天的香气是不是还在。',
      '同一条路也会因为天气不同而改变。下过雨之后，砖缝里的灰尘被冲干净，平时看不出的细微高低变成一个个小水洼。人们经过时会稍微改变路线，绕过积水，又在前面重新汇合。没有人发出指令，这些临时形成的弯曲路线却十分自然，像是大家共同写下的另一张地图。',
      '冬天有一次降温，我穿得不够厚，走到一半就想折返。河边卖烤红薯的小车还在，老板把炉盖打开，热气在冷空气里聚成一小团。我买了一只，站在避风的墙边慢慢吃完。手指先暖起来，接着才觉得整个人不那么冷。那一段路因此有了一个与季节有关的记忆。',
      '重复走一条路并没有让我更快地厌倦它。相反，熟悉的部分像一个稳定的背景，让细小的变化更容易被看见。新开的店、修好的栏杆、树下多出来的一把椅子，平时很难单独引起注意，却会在某一天突然提醒你：这里一直在变化，只是大部分变化都发生得很慢。',
    ],
  },
  {
    title: '不赶时间的时候',
    paragraphs: [
      '刚开始散步时，我仍然保留着做计划的习惯。出门前会想好走多久，在哪座桥折返，还会估算回到家能不能赶上接下来的安排。有时明明看见一条值得拐进去的小巷，也因为担心超出预定时间而放弃。走路换了地方，心里那个计时器却一直没有停下来。',
      '我试着把路线缩短，只给自己留一段没有目标的时间。路口到了再决定往哪边走，遇见喜欢的树就停一会儿。开始时很不习惯，总觉得自己应该顺便完成一点事情，比如买菜、取快递，或者把一直没听完的节目听完。手里什么也不拿，耳机里没有声音，反而像是忘记了什么重要的东西。',
      '慢慢地，我发现空着的注意力并不会一直空着。它会落在鞋底踩过碎石的声音上，落在前面两个人说话时忽远忽近的语气上，也会落在一个尚未想明白的问题上。那些问题没有因为散步立刻得到答案，但不再紧紧挤在一起，彼此之间开始有了可以移动的位置。',
      '有一天我在路边坐了很久，看一辆货车倒进狭窄的巷子。司机下车查看了两次，店里的工作人员搬走门口的板凳，让出一点空间。整件事花了十几分钟，最后车顺利停好，也没有任何戏剧性的结果。我只是坐在那里看完了，第一次觉得这种没有产出的等待也可以很踏实。',
      '当然，并不是每次走出去都能让心情变好。有时天气闷热，路上嘈杂，或者一件烦心事仍然反复出现。回家后它可能还在，甚至没有减少多少。但至少那段时间里，我知道自己正在穿过怎样的街道，知道风从哪个方向吹来，身体没有完全被困在同一个念头里面。',
    ],
  },
  {
    title: '把街道当作生活的一部分',
    paragraphs: [
      '经常步行之后，我开始注意一条路为什么好走。树荫是不是连在一起，路口要等多久，人行道会不会突然变窄，长椅附近有没有可以停下来的地方。这些东西单独看都不显眼，却决定了一个人愿不愿意多走五分钟，也决定了带孩子或行动不便的人能不能从容地经过这里。',
      '附近有一处人行道曾经被停车占去大半。年轻人可以侧身走过去，推婴儿车的人却只能绕到机动车道。后来路边加了几根短柱，空出来的地方很快恢复了通行。没有增加什么引人注目的景观，只是让本来属于行人的空间重新可以被使用，这段路的感觉就明显不同了。',
      '我也逐渐认识了一些并不知道姓名的人。总在同一个时间带狗出来的老人，推着小车给店铺送货的工人，放学后在河边等家长的两个孩子。我们偶尔点头，有时只是在远处认出彼此。这样的熟悉很轻，不要求交换联系方式，也不需要把关系推进到某一个确定的程度。',
      '有一次常走的小桥封闭维修，我不得不绕到另一条街。那条街以前只在地图上看见过，实际走进去才发现路边有一排旧书店和一家修钟表的小铺。原本只是一次被迫改道，却让我多了一条回家的路线。后来桥修好了，我仍会偶尔绕过去，因为已经知道那里有什么值得看一眼。',
      '人和一座城市之间的关系，有时就是这样一点点建立起来的。先知道一条路通向哪里，再记得哪个转角下午会晒到太阳，最后能察觉一家小店今天没有照常开门。城市不再只由几个必须抵达的地点组成，那些连接地点的路，也开始占有自己的分量。',
    ],
  },
  {
    title: '走回去的路',
    paragraphs: [
      '现在我仍然会为一天排很多事情，也仍然会在时间紧张时打车或搭地铁。步行没有替代这些选择，它只是让我多了一种可以调整节奏的方法。晚饭后空出来的二十分钟，或者提前到达约定地点的一小段时间，都可以成为一段没有特别目的的路。',
      '我不再执着于每次都发现新东西。有时一路上很安静，树和店铺都与前一天一样，走到河边也没有遇见熟人。回家后问自己记住了什么，可能只想得起一盏路灯刚好亮起，或者有人在楼上练习一段反复弹错的旋律。没有更完整的故事，也不妨碍那段时间已经被好好度过。',
      '偶尔我会带朋友走这条路。他们可能更喜欢远处的大桥，也可能觉得那排旧店铺没有什么特别。我不会急着解释每个地方为什么值得看，只是边走边聊。属于自己的路线不必成为所有人的路线，一段记忆也不需要因为别人有了相同的感受，才获得存在的理由。',
      '最喜欢的仍然是回程。到了熟悉的路口，我知道再往前几分钟就会看见楼下的灯。身体已经有一点疲倦，脚步却比出门时更稳定。白天没做完的事情还在等着，新的消息也可能已经到了，但在真正进门以前，我还可以把最后一段路完整地走完。',
      '那条河并没有因为我开始散步而发生什么巨大的改变。它照样在早晨迎来第一批行人，在深夜慢慢安静下来。我只是终于愿意拿出一点时间，沿着它走一走。经过的次数多了，曾经模糊的地方逐渐清楚，那些原本只从车窗外掠过的生活，也有了可以停留的位置。',
    ],
  },
];

const sectionsEn = [
  {
    title: 'Starting from the Doorstep',
    paragraphs: [
      'The first time I truly walked the length of the river near where I live was on an unscheduled Saturday. I had only intended to grab breakfast, but stepping outside into bright, clear air, I decided to walk one bus stop further along the embankment. From a bus seat, this stretch had always been a blur of fast-retreating trees. Walking into it revealed a lower foot trail hidden behind the foliage, where morning light slipped through iron railings and danced across the rippling water.',
      'Beside the river stood an early-opening corner grocery. The shopkeeper was hauling cardboard boxes out front while gently watering potted plants. Water trickled down stone steps, etching a darker vein across the gray pavement. Moments like this happen every morning, yet I had never once noticed them. Not because they were distant, but because every time I passed by, I was preoccupied with arriving somewhere else.',
      'Before leaving home, I thought I knew this neighborhood intimately: the nearest metro entrance, which convenience store held my package deliveries, and which intersections to avoid during peak commute hours. But that knowledge felt like a task checklist—practical for running errands, yet silent on how the street transforms throughout the day, or who actually lives and breathes here.',
      'Underneath the bridge, I encountered a father coaching his young child on a training bike. Every time the child rolled past a stone pillar, he stopped, reached out to tap an old scratch mark on the granite, and set off again. The father never rushed him, trailing quietly a few steps behind. I had intended to briskly weave around them, but found myself slowing down, pausing beneath the arch to listen to the gentle bicycle bell echo against the running water.',
      'I did not walk very far that morning. By the time I returned home, breakfast had cooled, and my pedometer showed an unremarkable step count. Yet that brief walk felt longer and richer than any daily commute, filled with moments worth remembering, separated by quiet space. They required no photos, and needed no explanation to anyone else.',
    ],
  },
  {
    title: 'Different Times on the Same Road',
    paragraphs: [
      'After that, I began walking the riverbank at different hours of the day. Early mornings held damp streaks from street sweepers; afternoon benches sat mostly empty beneath dappled shade; by dusk, dog walkers, joggers, and parents pushing strollers filled the path again. The lines on a city map never change, but walking it feels like several distinct roads, each moving with its own cadence and soundscape.',
      'Along one gentle slope grew a cluster of sweet osmanthus trees. When I first caught their honeyed fragrance, I assumed someone nearby was airing fresh laundry. It took two more walks to find the source: minuscule golden blossoms nestled between deep green leaves, invisible from a distance. Ever since, each time I pass that slope, I lean instinctively closer to see if the autumn perfume lingers.',
      'Weather reshapes the path just as dramatically. After a sudden rain shower, dust washes clean from brick seams, and subtle gradations in the pavers pool into glassy puddles. Pedestrians naturally alter their stride, skirting standing water before converging back onto the centerline. Nobody directs the flow, yet these spontaneous detours weave a fluid, shared map of the street.',
      'During a sudden cold snap one winter, I ventured out underdressed and nearly turned back halfway through. Then I spotted the roasted sweet potato cart parked near the stone wall. The vendor lifted the iron lid, sending a plume of sweet steam into the crisp chill. I bought one and leaned against the wind-sheltered wall to eat it. Warmth spread through my fingertips first, then softened the chill throughout my whole body. That stretch of road became forever tied to the memory of winter warmth.',
      'Walking the same route repeatedly has never made it dull. On the contrary, familiarity acts as a steady canvas, making subtle shifts far easier to spot. A new storefront, a repaired railing, or an extra bench beneath an elm might escape casual notice, yet one day they quietly remind you: this neighborhood is constantly evolving, even if most changes unfold at an imperceptible pace.',
    ],
  },
  {
    title: 'When You Are Not in a Hurry',
    paragraphs: [
      'When I first began taking regular walks, I carried my rigid planning habits with me. Before leaving the apartment, I calculated exactly how long I would walk, which bridge to cross for the turnaround, and whether I would return in time for the next calendar alert. Even when an inviting side alley caught my eye, I resisted turning in for fear of exceeding the scheduled window. My feet were on a new path, but the stopwatch inside my head never stopped ticking.',
      'Gradually, I shortened the planned distance and intentionally carved out aimless time. When an intersection arrived, I picked a turn on impulse; when a particularly striking tree appeared, I lingered beneath it. At first, it felt profoundly unnatural, as if I should be accomplishing something practical—picking up groceries, retrieving mail, or playing a podcast episode. With empty hands and silent headphones, I felt as though I had forgotten something vital.',
      'Over time, I discovered that freed-up attention does not remain vacant for long. It gravitates toward the crunch of gravel beneath shoe soles, the rising and falling cadence of two strangers talking ahead, or an unresolved question that had been buried under daily busyness. Those questions did not magically resolve themselves on the sidewalk, but they ceased crowding tightly together, finding room to breathe and shift.',
      'One afternoon I sat on a low ledge for a long while, watching a delivery van carefully back into a narrow alley. The driver stepped down twice to measure the clearance, while a shop clerk shifted stools from the doorway to grant a few more inches. The maneuvering took nearly fifteen minutes, concluding smoothly with no drama or fanfare. Sitting there to the end, I realized for the first time that unhurried, unproductive waiting could feel deeply grounded and complete.',
      'Of course, going outside does not guarantee a lighter mood every time. Some afternoons are sultry and loud, or a lingering worry refuses to fade. When I return home, the concern might still be waiting on my desk. But at least for an hour, I knew which streets I had traversed, felt the direction of the wind against my skin, and kept my mind from remaining captive within a single circular thought.',
    ],
  },
  {
    title: 'Treating the Street as Part of Life',
    paragraphs: [
      'Walking habitually trained my eyes to notice what makes a street truly hospitable. Do tree canopies connect to provide continuous shade? How long is the wait at pedestrian crossings? Does the sidewalk abruptly pinch into a narrow ledge, and are there benches where one can pause without having to buy something? None of these details demand attention on their own, yet they decide whether someone walks five minutes further, or whether an elderly neighbor feels safe venturing out.',
      'Near my home, a sidewalk was once largely overrun by illegally parked delivery vans. Agile commuters could slip through sideways, but anyone with a stroller or wheelchair had to detour into traffic. Eventually, simple bollards were installed along the curb, instantly reclaiming the walkway. No elaborate landscaping was added—simply returning pedestrian space to pedestrians transformed the entire character of the block.',
      'I also began recognizing people whose names I will never know: an elderly man walking his retriever at the exact same hour, a delivery courier rolling handcarts to corner shops, and two schoolkids leaning against the railing waiting for their parents. We occasionally nod in passing, or merely exchange a glance of mutual recognition from afar. This gentle familiarity demands no exchange of phone numbers and carries no expectations.',
      'When a footbridge I frequently crossed closed for repairs, I was forced to detour onto a neighboring avenue. I had only ever seen that street on digital maps; walking it in person revealed a row of second-hand bookstores and an old watch repair counter. What began as an inconvenient detour gifted me an alternative route home. Even after the bridge reopened, I still wander down that avenue simply to glance into the bookshop windows.',
      'The bond between a person and a city forms through tiny, cumulative impressions like these. First you learn where a street leads; then you remember which corner catches late-afternoon sun; eventually you notice when a small bakery takes an unscheduled day off. The city ceases to be merely a collection of destinations; the paths connecting them claim their own weight and meaning.',
    ],
  },
  {
    title: 'The Way Back Home',
    paragraphs: [
      'Today, my calendar remains full of obligations, and when time presses, I still hail cabs or catch the subway. Walking never sought to replace those practical modes; it simply offered a way to modulate my internal tempo. An extra twenty minutes after dinner, or arriving slightly ahead of an appointment, can easily become an unhurried, purposeful stroll.',
      'I no longer obsess over uncovering something novel on every walk. Many days the river path is utterly quiet, the trees and storefronts mirror yesterday, and no familiar faces appear. Asking myself what I remember upon returning home, it might just be the amber glow of a streetlight switching on, or someone upstairs practicing a piano phrase and stumbling on the same note. There is no grand story, yet the time was spent with presence.',
      'Occasionally I invite friends to walk this route. Some gravitate toward the suspension bridge in the distance; others find the old shops unexceptional. I never rush to justify why a spot is worth seeing—we simply walk and converse. One\'s personal route need not become everyone\'s route, and a private memory does not require consensus to earn its right to exist.',
      'My favorite part of any walk remains the return leg. Reaching the familiar intersection, I know that just a few minutes ahead, my building\'s warm entryway light will emerge into view. My legs may feel lightly tired, but my stride is steadier than when I set out. Unfinished tasks still wait inside, and new messages may have landed, but until my hand touches the doorknob, I can savor walking the final stretch in full.',
      'The river never fundamentally changed because I took up walking beside it. It continues to welcome early joggers at dawn and ease into quiet long past midnight. I simply decided to grant myself a sliver of time to walk in step with it. With every passing season, places that once felt indistinct grow sharper in memory, and the life that used to blur past the car window finally finds a place to settle.',
    ],
  },
];

export function LongArticleDemo() {
  const [locale] = useLocale();
  const isEn = locale === 'en';
  const title = isEn ? 'Making Time for Walking' : '把时间留给步行';
  const sections = isEn ? sectionsEn : sectionsZh;

  return (
    <article id={LONG_ARTICLE_CONTENT_ID} className="reading-article">
      <h1>{title}</h1>
      {sections.map(section => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map(text => (
            <p key={text} data-print-splittable="true">
              {text}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
