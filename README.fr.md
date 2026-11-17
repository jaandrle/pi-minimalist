# pi-minimalist

[English](README.md) | [简体中文](README.zh-CN.md) | **Français**

> Traduction du [README.md](README.md) anglais ; en cas de divergence, la version anglaise fait foi. Les commandes, les noms de réglages et les clés JSON restent en anglais, pour que vous puissiez les retrouver dans l'interface.

**Moins de défilement. Plus de place pour la réponse.**

Un historique plus calme pour [Pi](https://pi.dev) : les appels d'outils volumineux deviennent des résumés d'une ligne, et vous ouvrez la sortie complète quand vous en avez besoin.

## Voir la différence

**Avant :** un seul appel d'outil occupe presque tout l'écran.

<img width="656" height="550" alt="before" src="https://github.com/user-attachments/assets/aa1602f7-5db1-49b8-a4d3-cbd1aef69ea0" />

**Après :** le même appel, sur une ligne.

<img width="699" height="50" alt="after" src="https://github.com/user-attachments/assets/c0e8bca4-afa7-42c1-9bf0-69f267d18d9f" />

**Cliquez** sur une ligne repliée pour l'ouvrir en plusieurs lignes. Cliquez sur l'une d'elles pour n'afficher que sa sortie. Cliquez sur la ligne `▾ Expanded · click to fold` au-dessus d'une série ouverte pour la replier.

<img src="docs/click.png" width="600" alt="Un clic sur une ligne repliée l'ouvre en lignes ; un clic sur une ligne n'ouvre que celle-ci">

Appuyez sur **Ctrl+O** pour développer la sortie des outils, y compris les diffs et la coloration syntaxique. Les lignes développées renvoient aussi à la ligne les longues commandes au lieu de les couper. Rien n'est supprimé de la session ni caché au modèle : seul l'affichage change.

## Installation

```bash
pi install npm:pi-minimalist
```

Redémarrez Pi : les appels d'outils s'affichent en lignes compactes. Aucune configuration n'est nécessaire.

## Choisir le niveau de discrétion

Lancez **`/minimalist`** pour modifier les réglages en direct. Les réglages sont rangés en trois sections ; un sous-réglage n'apparaît que lorsque le réglage au-dessus de lui est activé :

- **Apparence** : le jeu de symboles (Unicode ou ASCII), la barre colorée à gauche de chaque ligne et la durée d'exécution des appels d'outils.
- **Compact output blocks into rows** (réduire les blocs de sortie en lignes) : appels d'outils et réflexion sur une seule ligne. En dessous, choisissez quels outils gardent leur propre carte (**Excluded tools** : tapez pour chercher, puis Entrée sur un outil pour le basculer), comment s'affiche un appel d'outil en cours (fusionné avec les autres, sur sa propre ligne, ou déplié comme avec Ctrl+O), et si la réflexion est dépliée pendant sa génération. Les deux peuvent garder cet affichage quelques secondes après la fin (3 s par défaut).
- **Merge consecutive rows into one** (fusionner les lignes consécutives) en un seul résumé, par exemple `read ×2, edit ×1`. En dessous, **Show only the final reply** (n'afficher que la réponse finale) garde la dernière réponse au premier plan et replie tout ce qui la précède en temps de travail ou en nombre d'outils. **Apply only to earlier turns** (seulement pour les tours précédents) garde le tour en cours entièrement visible jusqu'à votre prochain prompt.

Quand vous désactivez un réglage, les choix en dessous sont conservés et reviennent quand vous le réactivez.

Une nouvelle installation démarre avec le préréglage **`full`** (voir plus bas) : lignes d'outils compactes, appels regroupés et lignes de réflexion compactes. L'affichage de la seule réponse finale est facultatif. Choisissez `lite` si vous préférez voir chaque appel séparément.

### Préréglages

La ligne **Preset** en haut de `/minimalist` règle cinq options à la fois : **Compact output blocks into rows**, **Compact tool call blocks**, **Compact thinking blocks**, **Merge consecutive rows into one** et **Show only the final reply**.

| Préréglage | Ce que vous obtenez |
| --- | --- |
| `off` | Les cartes d'outils natives de Pi. |
| `lite` | Des lignes d'outils d'une ligne, chaque appel sur sa propre ligne. |
| `full` | `lite`, plus les appels consécutifs regroupés et les lignes de réflexion compactes. |
| `max` | `full`, plus la seule réponse finale (`Worked for …`). |
| `custom` | Vos propres valeurs pour ces cinq options. |

<img src="docs/presets.png" width="600" alt="L'écran de choix du préréglage">

Un préréglage n'écrase jamais vos réglages. Tant que `off`, `lite`, `full` ou `max` est sélectionné, seules ces cinq lignes sont grisées et affichent les valeurs du préréglage ; appuyer sur Entrée dessus ne fait rien. Toutes les autres options (les réglages d'apparence, Show a running tool call, etc.) restent à vous et restent modifiables, tant que le réglage au-dessus est activé (un préréglage qui désactive une ligne masque aussi les réglages en dessous). Vos propres valeurs sont conservées et reviennent quand vous choisissez `custom`. La première fois que vous choisissez `custom`, il part de `lite`.

**Mise à jour :** si vos réglages contiennent déjà un bloc `minimalist`, vous restez sur `custom` et gardez vos valeurs. Une seule règle est nouvelle : un réglage placé sous un réglage désactivé est ignoré, par exemple **Show only the final reply** quand **Merge consecutive rows into one** est désactivé. Seul un utilisateur sans aucun réglage `minimalist` démarre sur `full`, ce qui rend les lignes de réflexion compactes. Pour choisir un autre aspect, changez **Preset**.

### Commandes courantes

| Commande | Action |
| --- | --- |
| `/minimalist` | Ouvrir les réglages (`/minimalist config` fonctionne aussi) |
| `/minimalist status` | Afficher les réglages actuels |
| Ctrl+O | Développer ou replier la sortie des outils |
| Ctrl+T | Développer ou replier la réflexion |

Les réglages s'appliquent à l'historique existant et sont enregistrés globalement. Si un symbole s'affiche mal dans votre terminal, choisissez **Symbol set → ASCII**. Aucune Nerd Font n'est requise.

## Revenir à l'affichage habituel de Pi

Désactivez **Compact output blocks into rows** pour retrouver les cartes d'outils et la réflexion natives, ou seulement **Compact tool call blocks** pour les cartes d'outils. Ou choisissez le préréglage `off`.

Pour désactiver complètement l'extension, lancez `pi config`, désactivez pi-minimalist, puis redémarrez Pi.

## Compatibilité

Testé avec Pi **1.0.0**. Les mises à jour de Pi peuvent affecter la compatibilité du rendu ; [signalez un problème](https://github.com/EviHex/pi-minimalist/issues) en indiquant votre version de Pi, votre terminal et une capture d'écran.

[Licence MIT](LICENSE).
