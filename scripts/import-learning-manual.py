"""Import the supplied manual into a reviewable editorial seed; no AI calls."""
import json,re,sys,uuid
from pathlib import Path
text=Path(sys.argv[1]).read_text()
urls=dict(re.findall(r'^\[(S\d+)\]:\s*(https://\S+)',text,re.M))
refs={m[0]:m[1].strip() for m in re.findall(r'^\*\*(S\d+)\s*—\s*(.*?)\*\*',text,re.M)}
modules=[];documents=[]
questions=['Qu’est-ce que cette idée change pour moi, dans une journée ordinaire?','Quel petit détail de ma journée m’aide à comprendre cette habitude?','Qu’ai-je remarqué, en laissant les jugements de côté?','Comment pourrais-je rendre un repas plus simple et satisfaisant?','Quel ajustement préserverait le plaisir de manger?','Qu’ai-je ressenti, sans chercher à forcer une réponse?','Quel moment du repas aimerais-je savourer davantage?','Quelle autre lecture de la situation me semblerait plus juste?','Que dirais-je à un proche qui vit la même chose?','De quoi avais-je besoin à ce moment-là?','Quel petit espace de choix puis-je me donner?','Quel obstacle concret pourrais-je enlever cette semaine?','Comment préserver ce qui compte pour moi dans ce moment partagé?','Quel geste de récupération serait réaliste aujourd’hui?','Qu’est-ce que je souhaite conserver, simplifier ou ajuster?']
uid=lambda kind,n:str(uuid.uuid5(uuid.NAMESPACE_URL,f'https://tredmeal.com/program/habitudes-v1/{kind}/{n}'))
clean=lambda s:re.sub(r'\[S\d+\](?:,\s*)?','',s).strip().strip('-').strip()
for mod in re.finditer(r'^## Module (\d+) — ([^\n]+)\n(.*?)(?=^## Module |^## Annexe |\Z)',text,re.M|re.S):
 n=int(mod[1]); body=mod[3]
 objective=re.search(r'\*\*Objectif :\*\* (.+)',body)[1]
 mids=list(dict.fromkeys(re.findall(r'\[(S\d+)\]',objective)))
 modules.append(dict(id=uid('module',n),position=n,title=mod[2],objective=clean(objective)))
 for m in re.finditer(r'^### (\d+)\. ([^\n]+)\n(.*?)(?=^### |^\*\*Bilan du module|^## |\Z)',body,re.M|re.S):
  number=int(m[1]); title=m[2]; parts=m[3].strip().split('**À essayer :**',1)
  if len(parts)!=2: raise ValueError(number)
  explanation,action=parts
  ids=list(dict.fromkeys(re.findall(r'\[(S\d+)\]',m[3])+mids))
  if number==15:
   title='Reconnaître les automatismes et préparer ses choix'
   explanation='Certaines décisions se répètent presque automatiquement dans un contexte familier. Une intention réfléchie peut avoir besoin d’un repère concret pour prendre sa place dans une journée chargée.\n\nObserver le contexte, préparer une option simple et essayer à nouveau permet de chercher ce qui vous convient. Une difficulté n’est pas un défaut de volonté.'
   action='Repérez un moment où une habitude prend le dessus sur votre intention. Quelle petite modification du contexte pourrait vous aider à essayer autre chose?'
   ids=[s for s in ids if s not in ['S35','S36']]
  if number==41:
   title='Découvrir la densité énergétique avec souplesse'
   explanation='La densité énergétique décrit la quantité d’énergie contenue dans un poids donné d’aliment. L’eau, les fibres et les matières grasses influencent ce repère. Il peut aider à réfléchir à la composition d’un repas, sans classer les aliments en bons et mauvais.\n\nLes goûts, la faim, les besoins et le plaisir comptent aussi. Ce repère n’impose pas de supprimer un aliment apprécié.'
   action='Observez un repas habituel. Y a-t-il un accompagnement que vous aimez et que vous aimeriez y ajouter pour le rendre plus satisfaisant?'
   ids=[s for s in ids if s not in ['S35','S36']]
  sources=[dict(id=s,title=refs.get(s,s),url=urls[s]) for s in ids if s in urls and s not in ['S35','S36']]
  if not sources: sources=[dict(id='S18',title=refs['S18'],url=urls['S18'])]
  content=dict(title=title,objective=clean(objective),body=clean(explanation),action=clean(action),question=questions[n-1],sources=sources,
   limits='Information éducative générale. Les sources ne valident pas l’efficacité de ce parcours ni chaque exercice. Adapter aux contraintes de la personne; aucune prescription, aucun diagnostic ni résultat garanti. Révision professionnelle à prévoir pour les sujets de santé.',
   adaptations='Adapter les exemples, la longueur, la question et le petit essai au contexte déclaré. Conserver le concept, les faits sourcés et les limites; ne jamais interpréter un symptôme ni imposer une cible de poids ou de calories.',reviewedOn='2026-10-21')
  documents.append(dict(id=uid('step',number),module_id=uid('module',n),position=number,status='published' if n==1 else 'review',revision=1,draft=content,published=content if n==1 else None,published_revision=1 if n==1 else None))
assert len(modules)==15 and len(documents)==150
Path('content/program/habitudes-v1.json').write_text(json.dumps(dict(modules=modules,documents=documents),ensure_ascii=False,indent=2)+'\n')
# Seed remains independently inspectable; existing records are never overwritten.
quote=lambda x:"'"+str(x).replace("'","''")+"'"
rows=[]
for m in modules: rows.append('insert into public.learning_modules(id,position,title,objective) values('+','.join(quote(m[k]) for k in ['id','position','title','objective'])+') on conflict do nothing;')
for d in documents:
 c=quote(json.dumps(d['draft'],ensure_ascii=False))+'::jsonb'
 rows.append('insert into public.learning_documents(id,module_id,position,status,draft,published,published_revision) values('+','.join([quote(d['id']),quote(d['module_id']),str(d['position']),quote(d['status']),c,c if d['published'] else 'null','1' if d['published'] else 'null'])+') on conflict do nothing;')
rows.append("insert into public.learning_versions(document_id,revision,content,status) select id,revision,draft,status from public.learning_documents on conflict do nothing;")
Path('.local/guided-journal/seed.sql').write_text('\n'.join(rows)+'\n')
print(f'{len(modules)} modules, {len(documents)} fiches; 10 publiées, 140 à réviser.')
