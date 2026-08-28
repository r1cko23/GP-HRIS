
CREATE PROCEDURE [dbo].[sp_tkapprovedfinal]
    @idtimekeep INT,
    @idemployee INT,   
	@fname nvarchar(50),
	@lname nvarchar(50),
	@mname nvarchar(50),
    @datestart DATE,
    @dateend DATE,
	@payrolldate date,
	@payrollmonth nvarchar(25),
	@payrollmonthsort int,
	@payrollyear int,
	@dailyrate float, 
    @noofhourswork FLOAT,
    @dayswork FLOAT,

    @basic FLOAT,
    @totalsalary FLOAT,
    @Overtime_Hours FLOAT,
    @regularOT FLOAT,
    @Nightdiff_Hours FLOAT,
    @nightdiffpay FLOAT,
    @regularnightshiftOT_hours FLOAT,
    @regularnightshiftOT FLOAT,

    @LegalHoliday_Hours FLOAT,
	@LegalHoliday2_Hours FLOAT,
    @legalholiday FLOAT,
	@legalholiday2 FLOAT,
    @LegalHolidayOT_Hours FLOAT,
    @legalholidayOT FLOAT,
    @LegalHolidayND_Hours FLOAT,
    @legalholidayND FLOAT,
    @lhotndh FLOAT,
    @lhotnd FLOAT,

    @Holiday_Special_Hours FLOAT,
	@Holiday_Special2_Hours FLOAT,
    @Holiday_Special FLOAT,
	@Holiday_Special2 FLOAT,
    @Holiday_SpecialOT_Hours FLOAT,
    @Holiday_SpecialOT FLOAT,
    @Holiday_SpecialND_Hours FLOAT,
    @Holiday_SpecialND FLOAT,
    @shotndh FLOAT,
    @shotnd FLOAT,

    @WDOhours FLOAT,
    @WDO FLOAT,

    @RDhours FLOAT,
    @RD FLOAT,
    @RDothours FLOAT,
    @RDOT FLOAT,
    @rdndhours FLOAT,
    @RDND FLOAT,
    @rdndothours FLOAT,
    @RDNDot FLOAT,

    @lhwdohours FLOAT,
	@lhwdo float,
    @lhwdoothours FLOAT,
    @lhwdoot FLOAT,
    @lhwdondhours FLOAT,
    @lhwdond FLOAT,
    @lhwdootndhours FLOAT,
    @lhwdootnd FLOAT,

    @wdoshhours FLOAT,
    @wdosh FLOAT,
    @wdoshothours FLOAT,
    @wdoshot FLOAT,
    @wdoshndhours FLOAT,
    @wdoshnd FLOAT,
    @wdoshotndhours FLOAT,
    @wdoshotnd FLOAT,

    @tardinesshours FLOAT,
    @tardiness FLOAT,
    @undertimehours FLOAT,
    @absencesdays FLOAT,
    @absences FLOAT,
    @othermandatorybasis FLOAT,
    @ptodays FLOAT,
    @idjobposition INT,
	@jobposition nvarchar(100),
    @idclient INT,
	@companyname2 nvarchar(150),
	@iddepartment int,
	@departmentgroup nvarchar(70),
	@idclientbranch int,

	@regotrate float,
	@regndrate float,
	@regndotrate float,

	@lhrate float, 
	@lh2rate float, 
	@lhotrate float,
	@lhndrate float,
	@lhndotrate float,

	@shrate float,
	@sh2rate float,
	@shotrate float,
	@shndrate float,
	@shndotrate	float,

	@RDrate float,
	@RDOTrate float,
	@RDNDrate float,
	@RDNDotrate float,
			
	@lhwdorate float,
	@lhwdootrate float,
	@lhwdondrate float,
	@lhwdondotrate float,
		
	@shwdorate float,
	@shwdootrate float,
	@shwdondrate float,
	@shwdondotrate float, 

	@wdorate float,

	@allowance float,	
	@incomeadjustment float,
	@grossamt float,
	@grosstaxable float, 
	
	@paythrough nvarchar(30), 
    @bankaccountno nvarchar(30),
    @bankname nvarchar(30),
	
	@sssbasis  nvarchar(20),
    @phibasis  nvarchar(20),
    @ssssched  nvarchar(20),
	@wtaxsched nvarchar(20),

	@totalot float,
	@thirteenmonth float,
	@thirteenmonthytd float,
	@sil float,
	@uniform float,
	@nameplate float,

	@trxtype nvarchar(20),
	@netamount float,
	@thirteenmonthyear int,
	@gcash nvarchar(20),
	@frequencyofpayment nvarchar(30),
	@allowancenb float,
	@incomeadjustmentnb float,
	@uname nvarchar(5)






	 


AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO payroll_summary (
			idtimekeep,
            employee_id,
			fname2,
			lname2,
			mname2,
            date_start,
            date_end,
			payrolldate,
		
			payrollmonth,
			payrollmonthsort,
			payrollyear,
			dailyrate_payroll,
            noofhourswork,
            noofdayswork,
            basic,
            totalsalary,
            Overtime_Hours,
            overtime,
            Nightdiff_Hours,
            nightdiff,
            regularnightshiftOT_hours,
            regularnightshiftOT,
           
			LegalHoliday_Hours,
			LegalHoliday2_Hours,
            LegalHoliday,
			legalholiday2,
            LegalHolidayOT_Hours,
            LegalHolidayOT,
            LegalHolidayND_Hours,
            LegalHolidayND,
            lhotndh,
            lhotnd,
           
			Holiday_Special_Hours,
			specialholiday2_hours,
			
            Holiday_Special,
			specialholiday2,

            Holiday_SpecialOT_Hours,
            Holiday_SpecialOT,
            Holiday_SpecialND_Hours,
            Holiday_Specialnightdiff,
            shotndh,
            shotnd,
          
            RDhours,
            rd,
            RDothours,
            rdot,
            rdndhours,
            rdnd,
            rdndothours,
            rdndot,
           
			lhwdohours,
            lhwdo,
            lhwdoothours,
            lhwdoot,
            lhwdondhours,
            lhwdond,
            lhwdondothours,
            lhwdondot,
           
			shwdohours,
            shwdo,
            shwdoothours,
            shwdoot,
            shwdondhours,
            shwdond,
            shwdondothours,
            shwdondot,

			WDOhours,
            wdo,
           
		   
			Tardiness_Hours,
            tardiness,
            undertimehours,
            absencesdays,
            absences,
            othermandatorybasis,
            pto,
            idbranchpositionp,
			jobposition2,
            idclientp,
			companyname2,
			department_codep,
			departmentdesc2,
			idclientbranchp,

			regularOTrate,
			nightdiffrate,
			regularnightshiftOTrate,
			
			legalholidayrate,
			legalholidayrate2,

			legalholidayOTrate,
			legalholidayNDrate,
			lhotndrate,

			specialholidayrate,
			specialholidayrate2,

			specialholidayOTrate,
			specialholidaynightdiffrate,
			shotndrate, 

			RDrate,
			RDOTrate,
			RDNDrate,
			rdndotrate,
			
			lhwdorate,
			lhwdootrate,
			lhwdondrate,
			lhwdondotrate,
			
			shwdorate,
			shwdootrate,
			shwdondrate,
			shwdondotrate,

			wdorate,			   		 			
			
			allowancep,
			incomeadjustmentp,
			grossalary,
			grossamttaxable,

			payrollpaytype,
			payrollatmno,
			empbankname,

			sssbasis,
			philhealthbasis,
			schedstatutory2, 
			wtaxsched2,
			TotalOT,

			thirteenmonth,
			ytdthirteenmonth,
			silp,

			datalocked,
			transfertoforbilling,
			transfertoforbillingfinal, 
			databillingstatus,	
			trxtypep,
			netamount,

			withsss,
			withssspro,
			withphi,
			withpag,
			withtax,

			override,
			nodeduction,
			
			uniformp,
			nameplatep,
			thirteenmonthyear,
			gcashp,	
			frequencypayment,
			allowancenbp,
			incomeadjustmentnbp,

			pcreatedby,
			pcreateddate

					


	 	 			
			
        )
        VALUES (
			@idtimekeep,
            @idemployee,
			@fname,
			@lname,
			@mname,
            @datestart,
            @dateend,
			@payrolldate,
			@payrollmonth,
			@payrollmonthsort,
			@payrollyear,
			@dailyrate,

            @noofhourswork,
            @dayswork,
            @basic,
            @totalsalary,
            @Overtime_Hours,
            @regularOT,
            @Nightdiff_Hours,
            @nightdiffpay,
            @regularnightshiftOT_hours,
            @regularnightshiftOT,
           
			@LegalHoliday_Hours,
			@LegalHoliday2_Hours,

            @legalholiday,
			@legalholiday2,

            @LegalHolidayOT_Hours,
            @legalholidayOT,
            @LegalHolidayND_Hours,
            @legalholidayND,
            @lhotndh,
            @lhotnd,
           
			@Holiday_Special_Hours,
			@Holiday_Special2_Hours,
            
			@Holiday_Special,
			@Holiday_Special2,


            @Holiday_SpecialOT_Hours,
            @Holiday_SpecialOT,
            @Holiday_SpecialND_Hours,
            @Holiday_SpecialND,
            @shotndh,
            @shotnd,
          
			
            @RDhours,
            @RD,
            @RDothours,
            @RDOT,
            @rdndhours,
            @RDND,
            @rdndothours,
            @RDNDot,
           
			@lhwdohours,
			@lhwdo,
            @lhwdoothours,
            @lhwdoot,
            @lhwdondhours,
            @lhwdond,
            @lhwdootndhours,
            @lhwdootnd,
          
			@wdoshhours,
            @wdosh,
            @wdoshothours,
            @wdoshot,
            @wdoshndhours,
            @wdoshnd,
            @wdoshotndhours,
            @wdoshotnd,

			@WDOhours,
            @WDO,

            @tardinesshours,
            @tardiness,
            @undertimehours,
            @absencesdays,
            @absences,
            @othermandatorybasis,
            @ptodays,
            @idjobposition,
			@jobposition,
            @idclient,
			@companyname2,
			@iddepartment,
			@departmentgroup,
			@idclientbranch	,
			@regotrate,
			@regndrate,
			@regndotrate,
			@lhrate, 
			@lh2rate,
			@lhotrate,
			@lhndrate,
			@lhndotrate,
			@shrate,
			@sh2rate,
			@shotrate,
			@shndrate,
			@shndotrate,

			@RDrate,
			@RDOTrate,
			@RDNDrate,
			@RDNDotrate,
			
			@lhwdorate,
			@lhwdootrate,
			@lhwdondrate,
			@lhwdondotrate,
			
			@shwdorate,
			@shwdootrate,
			@shwdondrate,
			@shwdondotrate,

		    @wdorate,

			@allowance,		
			@incomeadjustment,
			@grossamt,
			@grosstaxable, 
			
			@paythrough, 
			@bankaccountno,
			@bankname, 

			@sssbasis, 
			@phibasis,
			@ssssched, 
			@wtaxsched,
			
			@totalot,

			@thirteenmonth,
			@thirteenmonthytd,
			@sil,
			


			'Yes', --datalocked
			'N',   --transfertoforbilling
			'N',   --transfertoforbilling
			'Ok',  --databillingstatus

			@trxtype,
			@netamount,

			'Y',  	--sss
			'Y',  	--sss pro
			'Y',  	--phi
			'Y',  	--pag
			'Y',  	--tax

			'False',	--Override
			'False',	--No dedection

			@uniform ,
			@nameplate,
			@thirteenmonthyear,
			@gcash,	
			@frequencyofpayment,
			@allowancenb,
			@incomeadjustmentnb,
			
			@uname,
			FORMAT(GETDATE(), 'MM/dd/yyyy hh:mm:ss tt')


        );
							 







        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

        DECLARE @ErrorMessage NVARCHAR(4000),
                @ErrorSeverity INT,
                @ErrorState INT;

        SELECT
            @ErrorMessage = ERROR_MESSAGE(),
            @ErrorSeverity = ERROR_SEVERITY(),
            @ErrorState = ERROR_STATE();

        RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
