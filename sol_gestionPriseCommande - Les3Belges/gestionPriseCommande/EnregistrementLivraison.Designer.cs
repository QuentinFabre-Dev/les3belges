namespace gestionPriseCommande
{
    partial class EnregistrementLivraison
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.label1 = new System.Windows.Forms.Label();
            this.comboNumCmd = new System.Windows.Forms.ComboBox();
            this.label2 = new System.Windows.Forms.Label();
            this.panel1 = new System.Windows.Forms.Panel();
            this.labelEmail = new System.Windows.Forms.Label();
            this.labelTel = new System.Windows.Forms.Label();
            this.labelAdresse = new System.Windows.Forms.Label();
            this.labelPrenom = new System.Windows.Forms.Label();
            this.labelNom = new System.Windows.Forms.Label();
            this.labelNum = new System.Windows.Forms.Label();
            this.label7 = new System.Windows.Forms.Label();
            this.label6 = new System.Windows.Forms.Label();
            this.label5 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.label8 = new System.Windows.Forms.Label();
            this.label9 = new System.Windows.Forms.Label();
            this.panel2 = new System.Windows.Forms.Panel();
            this.labelPrix = new System.Windows.Forms.Label();
            this.labelPoids = new System.Windows.Forms.Label();
            this.labelTransp = new System.Windows.Forms.Label();
            this.label12 = new System.Windows.Forms.Label();
            this.label14 = new System.Windows.Forms.Label();
            this.label15 = new System.Windows.Forms.Label();
            this.label10 = new System.Windows.Forms.Label();
            this.dataGridCmd = new System.Windows.Forms.DataGridView();
            this.nomProd = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.quantite = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.prixUnit = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.prixTTart = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.btnAnnuler = new System.Windows.Forms.Button();
            this.btnConfirmer = new System.Windows.Forms.Button();
            this.dataSet1 = new gestionPriseCommande.DataSet1();
            this.pRODUITBindingSource = new System.Windows.Forms.BindingSource(this.components);
            this.pRODUITTableAdapter = new gestionPriseCommande.DataSet1TableAdapters.PRODUITTableAdapter();
            this.poids = new System.Windows.Forms.DataGridViewTextBoxColumn();
            this.panel1.SuspendLayout();
            this.panel2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridCmd)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.dataSet1)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.pRODUITBindingSource)).BeginInit();
            this.SuspendLayout();
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(24, 59);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(123, 13);
            this.label1.TabIndex = 0;
            this.label1.Text = "Numero de commande : ";
            // 
            // comboNumCmd
            // 
            this.comboNumCmd.FormattingEnabled = true;
            this.comboNumCmd.Location = new System.Drawing.Point(153, 56);
            this.comboNumCmd.Name = "comboNumCmd";
            this.comboNumCmd.Size = new System.Drawing.Size(173, 21);
            this.comboNumCmd.TabIndex = 1;
            this.comboNumCmd.SelectedIndexChanged += new System.EventHandler(this.comboNumCmd_SelectedIndexChanged);
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label2.Location = new System.Drawing.Point(19, 16);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(29, 13);
            this.label2.TabIndex = 2;
            this.label2.Text = "N° :";
            // 
            // panel1
            // 
            this.panel1.BackColor = System.Drawing.SystemColors.ControlLight;
            this.panel1.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel1.Controls.Add(this.labelEmail);
            this.panel1.Controls.Add(this.labelTel);
            this.panel1.Controls.Add(this.labelAdresse);
            this.panel1.Controls.Add(this.labelPrenom);
            this.panel1.Controls.Add(this.labelNom);
            this.panel1.Controls.Add(this.labelNum);
            this.panel1.Controls.Add(this.label7);
            this.panel1.Controls.Add(this.label6);
            this.panel1.Controls.Add(this.label5);
            this.panel1.Controls.Add(this.label4);
            this.panel1.Controls.Add(this.label3);
            this.panel1.Controls.Add(this.label2);
            this.panel1.Location = new System.Drawing.Point(27, 107);
            this.panel1.Name = "panel1";
            this.panel1.Size = new System.Drawing.Size(299, 224);
            this.panel1.TabIndex = 3;
            // 
            // labelEmail
            // 
            this.labelEmail.AutoSize = true;
            this.labelEmail.Location = new System.Drawing.Point(70, 193);
            this.labelEmail.Name = "labelEmail";
            this.labelEmail.Size = new System.Drawing.Size(14, 13);
            this.labelEmail.TabIndex = 13;
            this.labelEmail.Text = "#";
            // 
            // labelTel
            // 
            this.labelTel.AutoSize = true;
            this.labelTel.Location = new System.Drawing.Point(54, 144);
            this.labelTel.Name = "labelTel";
            this.labelTel.Size = new System.Drawing.Size(14, 13);
            this.labelTel.TabIndex = 12;
            this.labelTel.Text = "#";
            // 
            // labelAdresse
            // 
            this.labelAdresse.AutoSize = true;
            this.labelAdresse.Location = new System.Drawing.Point(85, 102);
            this.labelAdresse.Name = "labelAdresse";
            this.labelAdresse.Size = new System.Drawing.Size(14, 13);
            this.labelAdresse.TabIndex = 11;
            this.labelAdresse.Text = "#";
            // 
            // labelPrenom
            // 
            this.labelPrenom.AutoSize = true;
            this.labelPrenom.Location = new System.Drawing.Point(214, 55);
            this.labelPrenom.Name = "labelPrenom";
            this.labelPrenom.Size = new System.Drawing.Size(14, 13);
            this.labelPrenom.TabIndex = 10;
            this.labelPrenom.Text = "#";
            // 
            // labelNom
            // 
            this.labelNom.AutoSize = true;
            this.labelNom.Location = new System.Drawing.Point(65, 55);
            this.labelNom.Name = "labelNom";
            this.labelNom.Size = new System.Drawing.Size(14, 13);
            this.labelNom.TabIndex = 9;
            this.labelNom.Text = "#";
            // 
            // labelNum
            // 
            this.labelNum.AutoSize = true;
            this.labelNum.Location = new System.Drawing.Point(54, 16);
            this.labelNum.Name = "labelNum";
            this.labelNum.Size = new System.Drawing.Size(14, 13);
            this.labelNum.TabIndex = 8;
            this.labelNum.Text = "#";
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label7.Location = new System.Drawing.Point(19, 193);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(45, 13);
            this.label7.TabIndex = 7;
            this.label7.Text = "Email :";
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label6.Location = new System.Drawing.Point(19, 144);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(33, 13);
            this.label6.TabIndex = 6;
            this.label6.Text = "Tél :";
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label5.Location = new System.Drawing.Point(19, 102);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(60, 13);
            this.label5.TabIndex = 5;
            this.label5.Text = "Adresse :";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label4.Location = new System.Drawing.Point(151, 55);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(57, 13);
            this.label4.TabIndex = 4;
            this.label4.Text = "Prénom :";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label3.Location = new System.Drawing.Point(19, 55);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(40, 13);
            this.label3.TabIndex = 3;
            this.label3.Text = "Nom :";
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.ForeColor = System.Drawing.SystemColors.ControlDark;
            this.label8.Location = new System.Drawing.Point(24, 91);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(99, 13);
            this.label8.TabIndex = 4;
            this.label8.Text = "Informations Client :";
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.ForeColor = System.Drawing.SystemColors.ControlDark;
            this.label9.Location = new System.Drawing.Point(24, 344);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(115, 13);
            this.label9.TabIndex = 6;
            this.label9.Text = "Informations Livraison :";
            // 
            // panel2
            // 
            this.panel2.BackColor = System.Drawing.SystemColors.ControlLight;
            this.panel2.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.panel2.Controls.Add(this.labelPrix);
            this.panel2.Controls.Add(this.labelPoids);
            this.panel2.Controls.Add(this.labelTransp);
            this.panel2.Controls.Add(this.label12);
            this.panel2.Controls.Add(this.label14);
            this.panel2.Controls.Add(this.label15);
            this.panel2.Location = new System.Drawing.Point(27, 360);
            this.panel2.Name = "panel2";
            this.panel2.Size = new System.Drawing.Size(299, 148);
            this.panel2.TabIndex = 5;
            // 
            // labelPrix
            // 
            this.labelPrix.AutoSize = true;
            this.labelPrix.Location = new System.Drawing.Point(61, 102);
            this.labelPrix.Name = "labelPrix";
            this.labelPrix.Size = new System.Drawing.Size(14, 13);
            this.labelPrix.TabIndex = 16;
            this.labelPrix.Text = "#";
            // 
            // labelPoids
            // 
            this.labelPoids.AutoSize = true;
            this.labelPoids.Location = new System.Drawing.Point(71, 55);
            this.labelPoids.Name = "labelPoids";
            this.labelPoids.Size = new System.Drawing.Size(14, 13);
            this.labelPoids.TabIndex = 15;
            this.labelPoids.Text = "#";
            // 
            // labelTransp
            // 
            this.labelTransp.AutoSize = true;
            this.labelTransp.Location = new System.Drawing.Point(112, 16);
            this.labelTransp.Name = "labelTransp";
            this.labelTransp.Size = new System.Drawing.Size(14, 13);
            this.labelTransp.TabIndex = 14;
            this.labelTransp.Text = "#";
            // 
            // label12
            // 
            this.label12.AutoSize = true;
            this.label12.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label12.Location = new System.Drawing.Point(19, 102);
            this.label12.Name = "label12";
            this.label12.Size = new System.Drawing.Size(36, 13);
            this.label12.TabIndex = 5;
            this.label12.Text = "Prix :";
            // 
            // label14
            // 
            this.label14.AutoSize = true;
            this.label14.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label14.Location = new System.Drawing.Point(19, 55);
            this.label14.Name = "label14";
            this.label14.Size = new System.Drawing.Size(46, 13);
            this.label14.TabIndex = 3;
            this.label14.Text = "Poids :";
            // 
            // label15
            // 
            this.label15.AutoSize = true;
            this.label15.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.label15.Location = new System.Drawing.Point(19, 16);
            this.label15.Name = "label15";
            this.label15.Size = new System.Drawing.Size(87, 13);
            this.label15.TabIndex = 2;
            this.label15.Text = "Transporteur :";
            // 
            // label10
            // 
            this.label10.AutoSize = true;
            this.label10.ForeColor = System.Drawing.SystemColors.ControlDark;
            this.label10.Location = new System.Drawing.Point(407, 91);
            this.label10.Name = "label10";
            this.label10.Size = new System.Drawing.Size(129, 13);
            this.label10.TabIndex = 8;
            this.label10.Text = "Informations Commande  :";
            // 
            // dataGridCmd
            // 
            this.dataGridCmd.BackgroundColor = System.Drawing.SystemColors.ScrollBar;
            this.dataGridCmd.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dataGridCmd.Columns.AddRange(new System.Windows.Forms.DataGridViewColumn[] {
            this.nomProd,
            this.quantite,
            this.prixUnit,
            this.prixTTart,
            this.poids});
            this.dataGridCmd.GridColor = System.Drawing.SystemColors.AppWorkspace;
            this.dataGridCmd.Location = new System.Drawing.Point(410, 115);
            this.dataGridCmd.Name = "dataGridCmd";
            this.dataGridCmd.ReadOnly = true;
            this.dataGridCmd.Size = new System.Drawing.Size(578, 242);
            this.dataGridCmd.TabIndex = 9;
            // 
            // nomProd
            // 
            this.nomProd.AutoSizeMode = System.Windows.Forms.DataGridViewAutoSizeColumnMode.Fill;
            this.nomProd.HeaderText = "Nom ";
            this.nomProd.Name = "nomProd";
            this.nomProd.ReadOnly = true;
            // 
            // quantite
            // 
            this.quantite.HeaderText = "Quantité";
            this.quantite.Name = "quantite";
            this.quantite.ReadOnly = true;
            // 
            // prixUnit
            // 
            this.prixUnit.HeaderText = "Prix Unit";
            this.prixUnit.Name = "prixUnit";
            this.prixUnit.ReadOnly = true;
            // 
            // prixTTart
            // 
            this.prixTTart.HeaderText = "Prix Total";
            this.prixTTart.Name = "prixTTart";
            this.prixTTart.ReadOnly = true;
            // 
            // btnAnnuler
            // 
            this.btnAnnuler.Location = new System.Drawing.Point(746, 377);
            this.btnAnnuler.Name = "btnAnnuler";
            this.btnAnnuler.Size = new System.Drawing.Size(99, 29);
            this.btnAnnuler.TabIndex = 10;
            this.btnAnnuler.Text = "Annuler";
            this.btnAnnuler.UseVisualStyleBackColor = true;
            // 
            // btnConfirmer
            // 
            this.btnConfirmer.Location = new System.Drawing.Point(867, 377);
            this.btnConfirmer.Name = "btnConfirmer";
            this.btnConfirmer.Size = new System.Drawing.Size(99, 29);
            this.btnConfirmer.TabIndex = 11;
            this.btnConfirmer.Text = "Confirmer";
            this.btnConfirmer.UseVisualStyleBackColor = true;
            // 
            // dataSet1
            // 
            this.dataSet1.DataSetName = "DataSet1";
            this.dataSet1.SchemaSerializationMode = System.Data.SchemaSerializationMode.IncludeSchema;
            // 
            // pRODUITBindingSource
            // 
            this.pRODUITBindingSource.DataMember = "PRODUIT";
            this.pRODUITBindingSource.DataSource = this.dataSet1;
            // 
            // pRODUITTableAdapter
            // 
            this.pRODUITTableAdapter.ClearBeforeFill = true;
            // 
            // poids
            // 
            this.poids.HeaderText = "Poids Prod";
            this.poids.Name = "poids";
            this.poids.ReadOnly = true;
            // 
            // EnregistrementLivraison
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1036, 530);
            this.Controls.Add(this.btnConfirmer);
            this.Controls.Add(this.btnAnnuler);
            this.Controls.Add(this.dataGridCmd);
            this.Controls.Add(this.label10);
            this.Controls.Add(this.label9);
            this.Controls.Add(this.panel2);
            this.Controls.Add(this.label8);
            this.Controls.Add(this.panel1);
            this.Controls.Add(this.comboNumCmd);
            this.Controls.Add(this.label1);
            this.Name = "EnregistrementLivraison";
            this.Text = "EnregistrementLivraison";
            this.Load += new System.EventHandler(this.EnregistrementLivraison_Load);
            this.panel1.ResumeLayout(false);
            this.panel1.PerformLayout();
            this.panel2.ResumeLayout(false);
            this.panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridCmd)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.dataSet1)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.pRODUITBindingSource)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.ComboBox comboNumCmd;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.Label label9;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Label label12;
        private System.Windows.Forms.Label label14;
        private System.Windows.Forms.Label label15;
        private System.Windows.Forms.Label label10;
        private System.Windows.Forms.DataGridView dataGridCmd;
        private System.Windows.Forms.Label labelEmail;
        private System.Windows.Forms.Label labelTel;
        private System.Windows.Forms.Label labelAdresse;
        private System.Windows.Forms.Label labelPrenom;
        private System.Windows.Forms.Label labelNom;
        private System.Windows.Forms.Label labelNum;
        private System.Windows.Forms.Label labelPrix;
        private System.Windows.Forms.Label labelPoids;
        private System.Windows.Forms.Label labelTransp;
        private System.Windows.Forms.Button btnAnnuler;
        private System.Windows.Forms.Button btnConfirmer;
        private DataSet1 dataSet1;
        private System.Windows.Forms.BindingSource pRODUITBindingSource;
        private DataSet1TableAdapters.PRODUITTableAdapter pRODUITTableAdapter;
        private System.Windows.Forms.DataGridViewTextBoxColumn nomProd;
        private System.Windows.Forms.DataGridViewTextBoxColumn quantite;
        private System.Windows.Forms.DataGridViewTextBoxColumn prixUnit;
        private System.Windows.Forms.DataGridViewTextBoxColumn prixTTart;
        private System.Windows.Forms.DataGridViewTextBoxColumn poids;
    }
}