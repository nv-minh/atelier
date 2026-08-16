import os, urllib.request, urllib.parse, concurrent.futures, json, sys

BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets"

# word_slug : CLDR emoji folder name
MAP = {
# --- 28 chủ đề ---
"topic-food":"Fork and knife with plate","topic-travel":"Airplane","topic-family":"Family",
"topic-body":"Anatomical heart","topic-home":"House","topic-work":"Briefcase",
"topic-education":"Graduation cap","topic-nature":"Deciduous tree","topic-emotions":"Smiling face with smiling eyes",
"topic-clothing":"T-shirt","topic-sports":"Soccer ball","topic-technology":"Laptop",
"topic-animals":"Paw prints","topic-money":"Money bag","topic-city":"Cityscape",
"topic-communication":"Speech balloon","topic-mind":"Brain","topic-time":"Alarm clock",
"topic-conversation":"Speaking head","topic-it-programming":"Desktop computer","topic-business":"Necktie",
"topic-toeic":"Direct hit","topic-medical":"Stethoscope","topic-legal":"Balance scale",
"topic-finance":"Chart increasing","topic-daily-life":"Sun","topic-social":"Party popper",
"topic-office-skills":"Clipboard",
# --- động vật ---
"dog":"Dog face","cat":"Cat face","mouse":"Mouse face","rabbit":"Rabbit face","fox":"Fox",
"bear":"Bear","panda":"Panda","koala":"Koala","tiger":"Tiger face","lion":"Lion",
"cow":"Cow face","pig":"Pig face","frog":"Frog","monkey":"Monkey face","chicken":"Chicken",
"penguin":"Penguin","bird":"Bird","eagle":"Eagle","duck":"Duck","swan":"Swan","owl":"Owl",
"bat":"Bat","wolf":"Wolf","horse":"Horse face","bee":"Honeybee","butterfly":"Butterfly",
"snail":"Snail","ant":"Ant","mosquito":"Mosquito","cricket":"Cricket","spider":"Spider",
"scorpion":"Scorpion","turtle":"Turtle","snake":"Snake","lizard":"Lizard","octopus":"Octopus",
"whale":"Whale","dolphin":"Dolphin","fish":"Fish","shark":"Shark","crocodile":"Crocodile",
"zebra":"Zebra","gorilla":"Gorilla","elephant":"Elephant","rhinoceros":"Rhinoceros",
"camel":"Camel","giraffe":"Giraffe","kangaroo":"Kangaroo","sloth":"Sloth","otter":"Otter",
"deer":"Deer","goat":"Goat","llama":"Llama","sheep":"Ewe","rooster":"Rooster","turkey":"Turkey",
"peacock":"Peacock","parrot":"Parrot","flamingo":"Flamingo","dove":"Dove","crab":"Crab",
"shrimp":"Shrimp","lobster":"Lobster","snake2":"Snake","worm":"Worm","beetle":"Beetle",
# --- đồ ăn ---
"apple":"Red apple","banana":"Banana","bread":"Bread","cheese":"Cheese wedge","egg":"Egg",
"grapes":"Grapes","hamburger":"Hamburger","lemon":"Lemon","orange":"Tangerine","pizza":"Pizza",
"rice":"Cooked rice","sandwich":"Sandwich","strawberry":"Strawberry","watermelon":"Watermelon",
"carrot":"Carrot","corn":"Ear of corn","cake":"Shortcake","coffee":"Hot beverage","tea":"Teacup without handle",
"cookie":"Cookie","popcorn":"Popcorn","taco":"Taco","doughnut":"Doughnut","candy":"Candy",
"avocado":"Avocado","broccoli":"Broccoli","mushroom":"Mushroom","peanut":"Peanuts","pretzel":"Pretzel",
"cherry":"Cherries","peach":"Peach","pear":"Pear","pineapple":"Pineapple","coconut":"Coconut",
"mango":"Mango","kiwi":"Kiwi fruit","tomato":"Tomato","potato":"Potato","onion":"Onion",
"garlic":"Garlic","cucumber":"Cucumber","eggplant":"Eggplant","butter":"Butter","bacon":"Bacon",
"sushi":"Sushi","dumpling":"Dumpling","honey":"Honey pot","salt":"Salt","milk":"Glass of milk",
"beer":"Beer mug","wine":"Wine glass","icecream":"Ice cream","chocolate":"Chocolate bar",
# --- phương tiện ---
"car":"Automobile","bus":"Bus","taxi":"Taxi","truck":"Delivery truck","bicycle":"Bicycle",
"motorcycle":"Motorcycle","train":"Train","tram":"Tram","ship":"Ship","sailboat":"Sailboat",
"rocket":"Rocket","helicopter":"Helicopter","airplane":"Airplane","ambulance":"Ambulance",
"tractor":"Tractor","police-car":"Police car","fire-engine":"Fire engine","canoe":"Canoe",
# --- thiên nhiên / thời tiết ---
"sun":"Sun","moon":"Crescent moon","star":"Star","cloud":"Cloud","rainbow":"Rainbow",
"fire":"Fire","mountain":"Mountain","volcano":"Volcano","desert":"Desert","beach":"Beach with umbrella",
"tree":"Deciduous tree","palm":"Palm tree","cactus":"Cactus","rose":"Rose","tulip":"Tulip",
"sunflower":"Sunflower","leaf":"Fallen leaf","maple":"Maple leaf","clover":"Four leaf clover",
"seedling":"Seedling","shell":"Spiral shell","snowflake":"Snowflake","tornado":"Tornado",
"umbrella":"Umbrella with rain drops","water":"Droplet","wave":"Water wave","globe":"Globe showing Europe-Africa",
# --- nhà cửa / đồ vật ---
"bed":"Bed","chair":"Chair","door":"Door","window":"Window","toilet":"Toilet","shower":"Shower",
"bathtub":"Bathtub","mirror":"Mirror","clock":"Alarm clock","candle":"Candle","key":"Key",
"lock":"Locked","hammer":"Hammer","wrench":"Wrench","screwdriver":"Screwdriver","gear":"Gear",
"broom":"Broom","basket":"Basket","soap":"Soap","sponge":"Sponge","bucket":"Bucket",
"toothbrush":"Toothbrush","razor":"Razor","thread":"Thread","needle":"Sewing needle",
"teddy":"Teddy bear","balloon":"Balloon","gift":"Wrapped gift","bulb":"Light bulb",
"battery":"Battery","magnet":"Magnet","ladder":"Ladder","brick":"Brick","chains":"Chains",
# --- học tập / công việc ---
"books":"Books","book":"Open book","notebook":"Notebook","pencil":"Pencil","pen":"Pen",
"paintbrush":"Paintbrush","crayon":"Crayon","scissors":"Scissors","paperclip":"Paperclip",
"ruler":"Straight ruler","calendar":"Calendar","memo":"Memo","envelope":"Envelope",
"package":"Package","briefcase":"Briefcase","backpack":"Backpack","keyboard":"Keyboard",
"printer":"Printer","telephone":"Telephone","phone":"Mobile phone","camera":"Camera",
"television":"Television","radio":"Radio","headphone":"Headphone","guitar":"Guitar",
"piano":"Musical keyboard","violin":"Violin","drum":"Drum","trumpet":"Trumpet",
"saxophone":"Saxophone","microphone":"Microphone","bell":"Bell","trophy":"Trophy",
"medal":"1st place medal","dice":"Game die","puzzle":"Puzzle piece","abacus":"Abacus",
# --- cơ thể / y tế ---
"eye":"Eye","ear":"Ear","nose":"Nose","mouth":"Mouth","tooth":"Tooth","bone":"Bone",
"brain":"Brain","lungs":"Lungs","heart":"Anatomical heart","pill":"Pill","syringe":"Syringe",
"thermometer":"Thermometer","bandage":"Adhesive bandage","microscope":"Microscope","dna":"Dna",
"crutch":"Crutch","xray":"X-ray","stethoscope":"Stethoscope",
# --- thể thao ---
"soccer":"Soccer ball","basketball":"Basketball","tennis":"Tennis","volleyball":"Volleyball",
"baseball":"Baseball","bowling":"Bowling","badminton":"Badminton","boxing":"Boxing glove",
"skateboard":"Skateboard","kite":"Kite","fishing":"Fishing pole","ice-skate":"Ice skate",
}

def fname(folder):
    return folder.lower().replace(' ','_').replace('-','_').replace("'","") + "_3d.png"

def get(item):
    slug, folder = item
    url = f"{BASE}/{urllib.parse.quote(folder)}/3D/{fname(folder)}"
    out = f"assets3d/{slug}.png"
    try:
        req = urllib.request.Request(url, headers={'User-Agent':'atelier-asset-fetch'})
        with urllib.request.urlopen(req, timeout=30) as r, open(out,'wb') as f:
            f.write(r.read())
        return (slug, folder, True)
    except Exception as e:
        return (slug, folder, False)

os.makedirs('assets3d', exist_ok=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
    res = list(ex.map(get, MAP.items()))

ok  = [r for r in res if r[2]]
bad = [r for r in res if not r[2]]
print(f"OK {len(ok)} / {len(res)}  ({100*len(ok)//len(res)}%)")
print("MISS:", ", ".join(f"{s}({f})" for s,f,_ in bad))
json.dump({s:f for s,f,o in res if o}, open('assets3d-map.json','w'), ensure_ascii=False, indent=1)
