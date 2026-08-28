
-- =============================================
-- Author:		PAts Relos
-- Create date: 2025.Jan.27 @ 04:03
-- Description:	Billing click employee
-- =============================================
CREATE PROCEDURE [dbo].[usp_billingdetails_Listclick] 
	-- Add the parameters for the stored procedure here
		--@idpayrollsum INT,
		@idbilling Int
		--@idclientp INT, 
		--@Date_Start DateTime
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Select statements for procedure here
	--DECLARE
	--	@idpayrollsum INT, 
	--	@idclientp INT, 
	--	@Date_Start DateTime

	--SET @idpayrollsum = 403 
	--SET @idclientp = 15 
	--SET @Date_Start = '2022-12-01'

SELECT
IDBILLING	
,idpayrollsum
, Employee_id
, employeename
, Date_Start
, Date_End
, payrolldate

, noofhourswork1
, noofhourswork
, noofhoursworkadj
, Regular
, regulartotalamt
, regularadj  --amount

--, Regular_Hours

, Overtime_Hours1
, Overtime_Hours
, overtime
, overtimetotalamt
, Overtime_Hoursadj
, Overtimeadj


, coverupothours1
, coverupothours
, coverupot
, coverupottotalamt
, coverupothoursadj
, coverupotadj

, Nightdiff_Hours1
, Nightdiff_Hours
, Nightdiff
, Nightdifftotalamt
, Nightdiff_Hoursadj
, Nightdiffadj

, NightdiffOT_Hours1
, NightdiffOT_Hours

, regularnightshiftOT_hours1
, regularnightshiftOT_hours
, regularnightshiftOT
, regularnightshiftOTtotalamt  
, regularnightshiftOT_hoursadj
, regularnightshiftOTadj

,LegalHoliday_Hours1
,LegalHoliday_Hours
,LegalHoliday
,LegalHolidaytotalamt
,LegalHoliday_Hoursadj
,LegalHolidayadj

,LegalHolidayOT_Hours1
,LegalHolidayOT_Hours
,LegalHolidayOT
,LegalHolidayOTtotalamt
,LegalHolidayOT_hoursadj
,LegalHolidayOTadj

,LegalHolidayND_Hours1
,LegalHolidayND_Hours
,LegalHolidayND
,LegalHolidayNDtotalamt
,LegalHolidayND_Hoursadj
,LegalHolidayNDadj
					  
,lhotndh1
,lhotndh
,lhotnd
,lhotndtotalamt
,lhotndhadj
,lhotndadj	 


,Holiday_Special_Hours1
,Holiday_Special_Hours
,Holiday_Special
,Holiday_Specialtotalamt
,Holiday_Special_Hoursadj
,Holiday_Specialadj

, Holiday_SpecialOT_Hours1
, Holiday_SpecialOT_Hours
, Holiday_SpecialOT
, Holiday_SpecialOTtotalamt
, Holiday_SpecialOT_Hoursadj
, Holiday_SpecialOTadj

,Holiday_SpecialND_Hours1
,Holiday_SpecialND_Hours
,Holiday_SpecialND
,Holiday_SpecialNDtotalamt
,Holiday_SpecialND_Hoursadj
,Holiday_SpecialNDadj

, shotndh1
, shotndh
, shotnd
, shotndtotalamt
, shotndhadj
, shotndadj
		   
, WDOhours1
, WDOhours
, WDO
, WDOtotalamt
, WDOhoursadj
, WDOadj



--, RDhours1
, RDhours
, rd
--, rdtotalamt
--, RDhoursadj
--, rdadj



, RDothours1
, RDothours
, rdot
, rdottotalamt
, RDothoursadj
, rdotadj
		  
, rdndhours1
, rdndhours
, rdnd
, rdndtotalamt
, rdndhoursadj
, rdndadj

, lhwdohours1
, lhwdohours
, lhwdo
, lhwdototalamt
, lhwdohoursadj
, lhwdoadj

, lhwdoothours1
, lhwdoothours
, lhwdoot
, lhwdoottotalamt
, lhwdoothoursadj
, lhwdootadj


, lhwdondhours1
, lhwdondhours
, lhwdond
, lhwdondtotalamt
, lhwdondhoursadj
, lhwdondadj


, lhwdootndhours1
, lhwdootndhours
, lhwdootnd
, lhwdootndtotalamt
, lhwdootndhoursadj
, lhwdootndadj


, wdoshhours1
, wdoshhours
, wdosh
, wdoshtotalamt
, wdoshhoursadj
, wdoshadj


, wdoshothours1
, wdoshothours
, wdoshot
, wdoshottotalamt
, wdoshothoursadj
, wdoshotadj

, wdoshndhours1
, wdoshndhours
, wdoshnd
, wdoshndtotalamt
, wdoshndhoursadj
, wdoshndadj
		 
, wdoshotndhours1
, wdoshotndhours
, wdoshotnd
, wdoshotndtotalamt
, wdoshotndhoursadj
, wdoshotndadj


, Tardiness_Hours
, absencesdays

,BILLINGTABLE.billinghourlyrate  
,BILLINGTABLE.billingcoverupovertimerate  
,BILLINGTABLE.billingregularOTrate  
,BILLINGTABLE.billingregularnightdiffrate  
,BILLINGTABLE.billingnightdiffrate  
,BILLINGTABLE.billinglegalholidayrate  
,BILLINGTABLE.billinglegalholidayOTrate  
,BILLINGTABLE.billinglegalholidayNDrate  
,BILLINGTABLE.billinglhotndrate  
,BILLINGTABLE.billingspecialholidayrate  
,BILLINGTABLE.billingspecialholidayOTrate  
,BILLINGTABLE.billingspecialholidaynightdiffrate  
,BILLINGTABLE.billingshotndrate  
,BILLINGTABLE.billingWDOrate  
,BILLINGTABLE.billingrdrate  
,BILLINGTABLE.billingrdotrate  
,BILLINGTABLE.billingrdndrate  
,BILLINGTABLE.billingLHWDORATE  
,BILLINGTABLE.billingLHWDOOTRATE  
,BILLINGTABLE.billingLHWDONDRATE  
,BILLINGTABLE.billingLHWDOOTNDRATE 
,BILLINGTABLE.billingWDOSHRATE  
,BILLINGTABLE.billingWDOSHOTRATE 
,BILLINGTABLE.billingWDOSHNDRATE 
,BILLINGTABLE.billingWDOSHOTNDRATE



, contributionSSSEE
, contributionSSSER
, contributionSSSECC
, contributionPagibigEE
, contributionPagibigER
, contributionphilhealthEE
, contributionphilhealthER
, Wtax
, netamount
,billingremarks
,BILLINGTABLE.dailyrate_payroll
,BILLINGTABLE.fixrate
,dailyratedivisor
,BILLINGTABLE.fixmonthlyrate
,billingtable.monthlyrates
,BILLINGTABLE.billingallowance
,bcreatedby
,bupdateby
,bcreateddate
,blastupdate
,BillingGroup
,billingsheetname
,billingtable.billingdepartment
,idbranchpositionp


,regularamount3
,regularovertime3
,nightdiffpay3
,coverupot3
,REGNDOT3

,legalholiday3
,legalholidayOT3
,legalholidayND3
,lhotnd3

,specialholiday3
,specialholidayot3
,SHnightdiff3
,shotnd3

,WDO3
,rdot3
,rdnd3

,lhwdo3
,lhwdoot3
,lhwdond3
,lhwdootnd3

,wdosh3
,wdoshot3
,wdoshnd3
,wdoshotnd3

,billingtable.regularOTrate -- payroll rate 
,billingtable.coverupotrate
,BILLINGTABLE.nightdiffrate
,BILLINGTABLE.regularnightshiftOTrate

,BILLINGTABLE.legalholidayrate,BILLINGTABLE.legalholidayOTrate,BILLINGTABLE.legalholidayNDrate,BILLINGTABLE.lhotndrate
,BILLINGTABLE.specialholidayrate,BILLINGTABLE.specialholidayOTrate,BILLINGTABLE.specialholidaynightdiffrate,BILLINGTABLE.shotndrate
,BILLINGTABLE.WDOrate,BILLINGTABLE.RDotrate,BILLINGTABLE.rdndrate
,BILLINGTABLE.lhwdorate,BILLINGTABLE.lhwdootrate,BILLINGTABLE.lhwdondrate,BILLINGTABLE.lhwdootndrate
,BILLINGTABLE.wdoshrate,BILLINGTABLE.wdoshotrate,BILLINGTABLE.wdoshndrate,BILLINGTABLE.wdoshotndrate
,contributionSSSEE,contributionSSSER,contributionSSSECC
,contributionSSSEEpro,contributionSSSERpro
,contributionphilhealthEE,contributionphilhealthER
,contributionPagibigEE,contributionPagibigER
,trxallowance
,Tardiness
,tardinessh2   -- tardiness number of hours adjustment
,tardiness3 -- amount for adjustment
,tardiness2
,tardinessh
,tardinesstotal
,billingtable.billingtardinessrate







						 FROM            client INNER JOIN
                         BILLINGTABLE ON client.idclient = BILLINGTABLE.idclientp INNER JOIN
                         client_branch_position ON BILLINGTABLE.idbranchpositionp = client_branch_position.idbranchposition

WHERE 
		IDBILLING = @idbilling  
		
	ORDER BY 
		Employee_id
                    
END
