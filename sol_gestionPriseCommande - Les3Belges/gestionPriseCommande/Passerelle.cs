using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Oracle.DataAccess;
using ProjLibraryClassReq;
using System.Data;
using les3belges;
using gestionPriseCommande;

namespace ClassLibraryL3B
{
    public class Passerelle
    {
        public static int DAOAutre(string requeteAutre)
        {
            int resultat;
            if (ClassReq.RetConnOk() == true)
            {
                ClassReq maClassReq = new ClassReq(requeteAutre);
                resultat = maClassReq.ExecuteIUD();
            }
            else
            {
                resultat = -1;
            }
            return resultat;
        }
        /// <summary>
        ///  Connection à la base, positionnement sur la base de données
        /// </summary>
        /// <returns>retourne true si bien passé</returns>
        public static bool connectBase()
        { 
            bool ok ;
            ClassReq.Connecter();
            ok = ClassReq.RetConnOk();
            return ok;
        }
        /// <summary>
        /// Insère une ligne dans ligneCommandeClient
        /// </summary>
        /// <param name="uneLigne">objet Ligne</param>
        /// <returns>retourne 1 si ok, 0 sinon</returns>
        public static int creerLigneCommande(LigneCommandeClient uneLigne)
        {
            int num = uneLigne.getLaCommande().getNumCommande();
            string reference=uneLigne.getLeProduit().getReference();
            int qte=uneLigne.getLaQuantité();
            double prixv = uneLigne.getLeProduit().getPrixUHTProduit();
            // remplacement virgule décimale par point décimal ...............à améliorer
            string prixP = prixv.ToString().Replace(",", ".");
            string requete = "INSERT INTO ligneCommandeClient VALUES( " + num + ",'"+ reference + "'," +  qte+","+ prixP +", 0, ' ')";
            ClassReq reqInsLig = new ClassReq(requete);
            int resultat = reqInsLig.ExecuteIUD();
            return resultat;
        }
        /// <summary>
        /// Retourne le plus grand numéro de commande
        /// </summary>
        /// <returns>le plus grand numéro ou 0 sil ny aps de ligne dans Commande</returns>
        public static int getMaxNumCde()
        {
            int maxNum;
            string req = "select max(numcommande) from commande";
            DataTable resultat =new DataTable();
            ClassReq reqMax = new ClassReq(req);
            resultat=reqMax.ExecuteSelect();
            if (resultat.Rows.Count==0)
                { maxNum = 0; }
            else
                { maxNum =Int32.Parse( resultat.Rows[0][0].ToString());}
            return maxNum;
        }
        /// <summary>
        /// Retourne le Client dont le numéro de téléphone est passé en paramètre n
        /// </summary>
        /// <param name="unTelephone">string le numéro de téléphone</param>
        /// <returns>objet Client</returns>
        public static Client getLeClientByTel(string unTelephone)
        {
            ClassReq.Connecter();
            Client unObjClient = null;
            if (ClassReq.RetConnOk() == true)
            {
                ClassReq afficherClasse = new ClassReq("select * from client where telephone='unTelephone'"); // creer une nouvelle requete
                DataTable res = new DataTable();
                res = afficherClasse.ExecuteSelect(); // recupere le resultat de la requete
                foreach (DataRow resLigne in res.Rows)
                {
                    int numClient = Int32.Parse(resLigne["numClient"].ToString()); // recuperer idClasse
                    string nomClient = resLigne["nomClient"].ToString();
                    string prenomClient = resLigne["prenomClient"].ToString();
                    string adresseClient = resLigne["adresse"].ToString();
                    string cpClient = resLigne["cp"].ToString();
                    string villeClient = resLigne["ville"].ToString();
                    string telClient = resLigne["telephone"].ToString();
                    string emailClient = resLigne["email"].ToString();

                    unObjClient = new Client(numClient, nomClient, prenomClient, adresseClient, cpClient, villeClient, telClient, emailClient);
                }
            }

            return unObjClient;
        }
        /// Retourne le Client dont le numéro est passé en paramètre n
        /// </summary>
        /// <param name="unTelephone">in le numéro de client</param>
        /// <returns>objet Client</returns>
        public static Client getLeClientByNum(int unNum)
        {
            Client unObjClient = null;
            if (ClassReq.RetConnOk() == true)
            {   // récupération des infos client dans la base
                string req = "select * from client where numClient=" + unNum.ToString();
                ClassReq ReqCli = new ClassReq(req); 
                DataTable res = new DataTable();
                res = ReqCli.ExecuteSelect(); 
                if (res.Rows.Count != 0)
                { 
                    // intanciation de l'objet client
                    int numClient = Int32.Parse(res.Rows[0]["numClient"].ToString());
                    string nomClient = res.Rows[0]["nomClient"].ToString();
                    string prenomClient = res.Rows[0]["prenomClient"].ToString();
                    string adresseClient = res.Rows[0]["adresse"].ToString();
                    string cpClient = res.Rows[0]["cp"].ToString();
                    string villeClient = res.Rows[0]["ville"].ToString();
                    string telClient = res.Rows[0]["telephone"].ToString();
                    string emailClient = res.Rows[0]["email"].ToString();
                    unObjClient = new Client(numClient, nomClient, prenomClient, adresseClient, cpClient, villeClient, telClient, emailClient);
                } 
            }
            return unObjClient;
        }


        /// Retourne une collection de commande avec le statut en attente
        /// </summary>
        /// <param name=""></param>
        /// <returns>Collection commande</returns>
        public static List<Commande> getCommandeAttentes()
        {
            List<Commande> cmdAttentes = new List<Commande>();
             Commande uneCommande = null;

            if (ClassReq.RetConnOk() == true)
            {   // récupération des infos client dans la base
                string req = "SELECT * FROM COMMANDE WHERE STATUTCOMMANDE = 'A'";

                ClassReq ReqCli = new ClassReq(req);
                DataTable res = new DataTable();
                res = ReqCli.ExecuteSelect();

                foreach (DataRow ligne in res.Rows)
                {
                    int numCmd = Convert.ToInt32(ligne["NUMCOMMANDE"]);
                    int dateCmd = Convert.ToInt32(ligne["DATECOMMANDE"]);
                    double montantCmd = Convert.ToDouble(ligne["MONTANTCOMMANDEHT"]);
                    String statutCmd = ligne["STATUTCOMMANDE"].ToString();
                    int numClient = Convert.ToInt32(ligne["NUMCLIENT"]);

                    uneCommande = new Commande(numCmd, dateCmd, montantCmd, statutCmd,0.0, getLeClientByNum(numClient));
                    cmdAttentes.Add(uneCommande);

                } 
            }
            return cmdAttentes;
        }

        /// Retourne l'expediteur pour l'id donnée 
        /// </summary>
        /// <param name="id"></param>
        /// <returns>expediteur</returns>
        public static Expediteur getExpediteurByID(int id)
        {
            string req = "SELECT IDEXP,NOMEXP FROM expediteur WHERE idexp ="+id;

            ClassReq ReqCli = new ClassReq(req);
            DataTable res = new DataTable();
            res = ReqCli.ExecuteSelect();

            int idexp = Convert.ToInt32(res.Rows[0][0].ToString());
            String libelle = res.Rows[0][0].ToString();

            Expediteur unExpediteur = new Expediteur(idexp, libelle);
            return unExpediteur;
        }






        /// Retourne l'expediteur le moins chère pour un poids donnée 
        /// </summary>
        /// <param name="poids"></param>
        /// <returns>Un objet FACTURER</returns>
        public static Facturer getBestExpediteur(double pds)
        {
            String pdsTxt = boiteOutil.changerNombreVirgule(pds*100);
            
            string req = "SELECT IDEXP,IDPOIDS,TARIFS FROM facturer WHERE tarifs = (SELECT MIN(TARIFS) FROM FACTURER WHERE idpoids = (SELECT MIN(idpoids) FROM facturer WHERE " + pdsTxt + " < idpoids))";
            
            ClassReq ReqCli = new ClassReq(req);
            DataTable res = new DataTable();
            res = ReqCli.ExecuteSelect();

            int idexp = Convert.ToInt32(res.Rows[0][0].ToString());
            double idpoids = Convert.ToDouble(res.Rows[0][1].ToString());
            double tarifs = Convert.ToDouble(res.Rows[0][2].ToString());

            Expediteur leExpediteur = Passerelle.getExpediteurByID(idexp);

            Facturer laFacture = new Facturer(leExpediteur, idpoids, Convert.ToDouble(tarifs));
            return laFacture;
        }



        /// Retourne une collection de LigneCommandeClient de la commande uneCOmmande
        /// </summary>
        /// <param name="uneCommande"></param>
        /// <returns>Collection LigneCommandeClient</returns>
        public static List<LigneCommandeClient> getLignesCmd(Commande uneCommande)
        {
            LigneCommandeClient uneLigne = null;
            List<LigneCommandeClient> lesLignes = new List<LigneCommandeClient>();

            string req = "SELECT * FROM LIGNECOMMANDECLIENT WHERE NUMCOMMANDE ="+uneCommande.getNumCommande();

            ClassReq ReqCli = new ClassReq(req);
            DataTable res = new DataTable();
            res = ReqCli.ExecuteSelect();

            foreach(DataRow ligne in res.Rows)
            {
                int uneQuantiteProduit =  Convert.ToInt32(ligne["QUANTITEPRODUIT"]);
                string refProd = ligne["REFERENCEPROD"].ToString();


                uneLigne = new LigneCommandeClient(uneQuantiteProduit, uneCommande, getProduit(refProd));
               lesLignes.Add(uneLigne);
            }

            return lesLignes;
        }




        /// <summary>
        /// Retourne le produit dont la référence est passée en paramètre
        /// </summary>
        /// <param name="uneReference">string une référence produit</param>
        /// <returns>objet Produit</returns>
        public static Produit getProduit(string uneReference)
        {
            Produit res = null;
            ClassReq.Connecter();
            if (ClassReq.RetConnOk() == true)
            {
                string req = "SELECT * FROM PRODUIT WHERE referenceProd = '" + uneReference + "'";
                ClassReq leProduit = new ClassReq(req);
                DataTable resultat = leProduit.ExecuteSelect();
                if (resultat.Rows.Count == 1)
                {
                    string referenceProd = resultat.Rows[0]["referenceProd"].ToString();
                    string libelleProduit = resultat.Rows[0]["libelleProduit"].ToString();
                    double prixUHT = Double.Parse(resultat.Rows[0]["prixUHT"].ToString());
                    double tauxTVA = Double.Parse(resultat.Rows[0]["tauxTVA"].ToString());
                    double poids = Double.Parse(resultat.Rows[0]["poids"].ToString());
                    int seuilReapro = Int32.Parse(resultat.Rows[0]["seuilReapro"].ToString());
                    int delaiReapro = Int32.Parse(resultat.Rows[0]["delaiReapro"].ToString());
                    int stockTemp = Int32.Parse(resultat.Rows[0]["stockTemp"].ToString());
                    string origineProduit = resultat.Rows[0]["origineProduit"].ToString();
                    string couleurProduit = resultat.Rows[0]["couleurProduit"].ToString();
                    string tailleProduit = resultat.Rows[0]["tailleProduit"].ToString();
                    int stockTheorique = Int32.Parse(resultat.Rows[0]["stockTheorique"].ToString());
                    int numFournisseur = Int32.Parse(resultat.Rows[0]["numFournisseur"].ToString());
                    int numCategorie = Int32.Parse(resultat.Rows[0]["numCategorie"].ToString());
                    //string numReduction = resultat.Rows[0]["numReduction"].ToString();
                    res = new Produit(referenceProd, libelleProduit, prixUHT, stockTheorique, tauxTVA, stockTemp, couleurProduit, tailleProduit, origineProduit, delaiReapro, seuilReapro,poids );

                }

            }

            return res;
        }
        /// <summary>
        ///  insère une ligne de la classe Commande dans la BDD  
        /// </summary>
        /// <param name="uneCommande">objet Commande</param>
        /// <returns>booléen 1 si bien inséré, 0 sinon</returns>
        public static int creerCommande(Commande uneCommande)
        {
            int insertCdeOK;
            int numCommande = uneCommande.getNumCommande();
            int dateCommande = boiteOutil.dateEnNum(DateTime.Today);
            double montantCommande = uneCommande.getMontantCommandeTTC();
            // conversion de la virgule décimale en point...................à améliorer
            string montantcdeP = montantCommande.ToString().Replace(",", ".");
            string statut = "A";
            int numClient = uneCommande.getLeClient().getNumClient();
            string req = "INSERT INTO Commande VALUES( " + numCommande + ",'" + dateCommande + "'," + montantcdeP + ", '" + statut + "', " + numClient + ")";
            ClassReq reqCreerCommande = new ClassReq(req);
            insertCdeOK = reqCreerCommande.ExecuteIUD();
            return insertCdeOK;
        }
        /// <summary>
        /// renvoie une chaine de deux caractères avec 0 devant si necessaire
        /// </summary>
        /// <param name="unechaine">une chaine représentant un mois ou un jour</param>
        /// <returns>la chaine complétée</returns>
      
        public static DateTime convertDatIntDate(int uneDateInt)
        {
            DateTime dateRet;
            int year = Int32.Parse(uneDateInt.ToString().Substring(0, 3));
            int month = Int32.Parse(uneDateInt.ToString().Substring(4, 5));
            int day = Int32.Parse(uneDateInt.ToString().Substring(6, 7));
            dateRet = new DateTime(year, month, day);
            return dateRet;
        }

        public static int DateNowToInt()
        {           
            string Ladate = DateTime.Now.ToString("dd/mm/yy");
            string dateInt = Ladate.Replace("/", "");
            return Convert.ToInt32(dateInt);
        }

        public static string checkMajuscule(string unNom)
        {
            string resultat;
            if (unNom.Length > 1)
                resultat = unNom.Substring(0, 1).ToUpper() + unNom.Substring(1);
            else if (unNom.Length == 1)
                resultat = unNom.ToUpper();
            else
                resultat = unNom;
            return resultat;
        }
        public static void majStockTempProd(Produit unProd )
        { 
            string req = "UPDATE PRODUIT set stockTemp = " + unProd.getStockTemp() + " where referenceProd = '" + unProd.getReference() + "'";
            int majOk = Passerelle.DAOAutre(req);
        }
        // Boite à outils
         /// <summary>
        /// retourne vrai si la chaine passéé en paramètre est un entier
         /// </summary>
         /// <param name="uneChaine">string une chaine</param>
         /// <returns>vrai si entier, faux sinon</returns>
        public static bool convertNum(string uneChaine)
        {
            bool oknum;
            try
                {   int res = Int32.Parse(uneChaine);
                    oknum = true;
                }
            catch
                { oknum = false; }
            return oknum;
        }
    }
}
