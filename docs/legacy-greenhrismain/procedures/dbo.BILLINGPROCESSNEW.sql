-- =============================================
-- Author:		<Pat Relos>
-- Create date: <1-21-2025>
-- Description:	<this process forwarded all necessary data needed to billing SOA>
-- =============================================
CREATE PROCEDURE [dbo].[BILLINGPROCESSNEW]
	 /*
	
	 @iddepartment NVARCHAR(20), 
	 @idbranch NVARCHAR(20),
	 @companydesc NVARCHAR(50),
	 @uname NVARCHAR(20),
	 @fname NVARCHAR(30),
	 @lname NVARCHAR(30),
	 @datestart date, 
	 @groupby nvarchar(15), 
	 @checkselect NVARCHAR(50)
	*/	
	@idclient INT,
	@uname NVARCHAR(20),
	@idpayroll INT,
	@billingreference nvarchar(20),
	@idbillingrefererence int,
	@billingdate date,
	@dcreated nvarchar(30)
	  			
AS	
BEGIN
SET NOCOUNT ON;


BEGIN TRY
        BEGIN TRANSACTION;
  
if @idclient <>12632121
BEGIN	

INSERT INTO BILLINGTABLE
(employeename		--1
,fname2
,lname2
,mname2
,idbranchpositionp	-- 2
,jobposition2		--3
,department_codep
,departmentdesc2	--4
,idbillingreference
,billingreference	--5
,idpayrollsum		--6
, Employee_id		--7
, Date_Start		--8
, Date_End			--9
, noofhourswork1		--10
, noofhourswork		--10
, Regular
, regulartotalamt
,idclientp			--11
,idclientbranchp
,payrolldate	   --12
,billingdate	   --13
,signprepared	   --14
,signapproved	   --15
,signnoted		   --16
,signpreparedrole
,signnotedrole

,Overtime_Hours1    --18 --othourspayroll
,Overtime_Hours    --18	 --totalothours
,Overtime
,Overtimetotalamt


,Nightdiff_Hours1   --19
,Nightdiff_Hours   --19
,nightdiff
,nightdifftotalamt

,regularnightshiftOT_hours1  --20
,regularnightshiftOT_hours  --20
,regularnightshiftOT
,regularnightshiftOTtotalamt

,LegalHoliday_Hours1		--21
,LegalHoliday_Hours		--21
,LegalHoliday
,LegalHolidaytotalamt

,LegalHoliday2_Hours
,legalholiday2totalamount



,LegalHolidayOT_Hours1	--22
,LegalHolidayOT_Hours	--22
,LegalHolidayOT
,LegalHolidayOTtotalamt

,LegalHolidayND_Hours1	--23
,LegalHolidayND_Hours	--23
,LegalHolidayND
,LegalHolidayNDtotalamt


,lhotndh1				--24
,lhotndh				--24
,lhotnd
,lhotndtotalamt

,Holiday_Special_Hours1
,Holiday_Special_Hours	--25
,Holiday_Special
,Holiday_Specialtotalamt

,specialholiday2_hours
,specialholiday2

,Holiday_SpecialOT_Hours1 --26
,Holiday_SpecialOT_Hours  --26
,Holiday_SpecialOT
,Holiday_SpecialOTtotalamt

,Holiday_Specialnd_Hours1 --27
,Holiday_Specialnd_Hours  --27
,Holiday_Specialnd
,Holiday_Specialndtotalamt

,shotndh1
,shotndh				  --28
,shotnd
,shotndtotalamt

,WDOhours1
,WDOhours				  --29
,WDO 
,WDOtotalamt



,RDhours				  --30	 
,RDothours1				  --30
,RDothours				  --30
,RDot
,RDottotalamt

,rdndhours1				  --31
,rdndhours				  --31
,rdnd
,rdndtotalamt

,lhwdohours1				  --32
,lhwdohours				  --32
,lhwdo
,lhwdototalamt

,lhwdoothours1			  --33
,lhwdoothours			  --33
,lhwdoot
,lhwdoottotalamt

,lhwdondhours1			  --34
,lhwdondhours			  --34
,lhwdond
,lhwdondtotalamt

,lhwdootndhours1			  --35
,lhwdootndhours			  --35
,lhwdootnd
,lhwdootndtotalamt

,wdoshhours1				  --36
,wdoshhours				  --36
,wdosh
,wdoshtotalamt

,wdoshothours1			  --37
,wdoshothours			  --37
,wdoshot
,wdoshottotalamt


,wdoshndhours1			  --38
,wdoshndhours			  --38
,wdoshnd
,wdoshndtotalamt

,wdoshotndhours1	  --39
,wdoshotndhours		  --39
,wdoshotnd
,wdoshotndtotalamt

,billingstatus
,BillingGroup
,billingsheetname
,BillingDepartment
,adminfee
,vat
,ewt
,billinghourlyrate  

,billingregularOTrate  
,billingregularnightdiffrate  
,billingnightdiffrate  

,billinglegalholidayrate  
,billinglegalholidayOTrate  
,billinglegalholidayNDrate  
,billinglhotndrate  

,legalholidayrate2
,billinglegalholidayrate2 

,billingspecialholidayrate  
,billingspecialholidayOTrate  
,billingspecialholidaynightdiffrate  
,billingshotndrate  

,specialholidayrate2
,billingspecialholidayrate2 


,billingWDOrate  



,billingrdrate  
,billingrdotrate  
,billingrdndrate 
,billingrdndotrate  


,billingLHWDORATE  
,billingLHWDOOTRATE  
,billingLHWDONDRATE  
,billingLHWDOOTNDRATE 
,billingWDOSHRATE  
,billingWDOSHOTRATE 
,billingWDOSHNDRATE 
,billingWDOSHOTNDRATE
,fixrate
,dailyratedivisor
,monthlyrates
,fixmonthlyrate
,templateuse
,bcreatedby
,bcreateddate
,Tardiness_Hours
,tardinessh-- totalhourstardines

,dailyrate_payroll --payrollrate Start
,regularOTrate 

,nightdiffrate
,regularnightshiftOTrate
,legalholidayrate,legalholidayOTrate,legalholidayNDrate,lhotndrate
,specialholidayrate,specialholidayOTrate,specialholidaynightdiffrate,shotndrate
,WDOrate
,RDrate,RDotrate,rdndrate
,lhwdorate,lhwdootrate,lhwdondrate,lhwdootndrate
,wdoshrate,wdoshotrate,wdoshndrate,wdoshotndrate
,contributionSSSEE,contributionSSSER,contributionSSSEEpro,contributionSSSERpro,contributionSSSECC
,contributionphilhealthEE,contributionphilhealthER
,contributionPagibigEE,contributionPagibigER
,totalmandatory
,othermandatorybasis
,basic
,absences
,absencesdays
,Tardiness
,tardinesstotal
,previoussssbasis
,payrollmonth
,dailyrate_billing
,incomeadjustment
,billingallowance
,incomeadjustmentnb
,billingallowancenb
,uniformbilling
,nameplatebilling
,silp
,thirteenmonth


)  
--SELECT insert

SELECT        
payroll_summary.lname2 + N', ' + payroll_summary.fname2 + N'  ' + payroll_summary.mname2 AS EmployeeName   --1
,fname2
,lname2
,mname2
,idbranchpositionp					--2
, client_branch_position.jobposition		--3
, payroll_summary.department_codep	--4
, payroll_summary.departmentdesc2	--4


, @idbillingrefererence
, @billingreference AS Expr1		--5
, payroll_summary.idpayrollsum		--6
, payroll_summary.Employee_id		--7
, payroll_summary.Date_Start		--8
, payroll_summary.Date_End			--9


,CASE  
   -- WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2)	--10
	WHEN payroll_summary.fixrate = 'Y' THEN noofhourswork 
    WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
END AS noofhoursworok1

,CASE  
    --WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2) --10
    WHEN payroll_summary.fixrate = 'Y' THEN noofhourswork 
	WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
END AS noofhoursworok2


--, payroll_summary.noofhourswork1 *billinghourlyrate as regularamt
--, payroll_summary.noofhourswork2 *billinghourlyrate as regularamttotal


-- Calculate regular amount
,    CASE  
  --      WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13 - payroll_summary.absencesdays, 0) * 8-(Tardiness_Hours/60), 2) * billinghourlyrate
        WHEN payroll_summary.fixrate = 'Y' THEN payroll_summary.noofhourswork * billinghourlyrate
		WHEN payroll_summary.fixrate = 'N' THEN payroll_summary.noofhourswork * billinghourlyrate
    END AS regularamt

    -- Calculate total regular amount
,    CASE  
    --    WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13 - payroll_summary.absencesdays, 0) * 8-(Tardiness_Hours/60), 2) * billinghourlyrate
        WHEN payroll_summary.fixrate = 'Y' THEN payroll_summary.noofhourswork * billinghourlyrate
		WHEN payroll_summary.fixrate = 'N' THEN payroll_summary.noofhourswork * billinghourlyrate
    END AS regularamttotal





, payroll_summary.idclientp			--11
,payroll_summary.idclientbranchp
, payroll_summary.payrolldate		--12
, @billingdate AS billdate			--13
, 'client.billingpreparedby'				--14
, 'client.billingpreparedby'				--15
, 'client.billingnotedby'					--16
, 'client.billingpreparedbyrole'
, 'client.billingnotedbyrole'

,Overtime_Hours						--18
,Overtime_Hours						--18
,Overtime_Hours * billingregularOTrate as otamt
,Overtime_Hours * billingregularOTrate as otamttotal


,Nightdiff_Hours 
,Nightdiff_Hours 					--19
,Nightdiff_Hours *billingnightdiffrate as nightdiffamt
,Nightdiff_Hours *billingnightdiffrate as nightdiffamttotal
										 										 
,regularnightshiftOT_hours			 --20
,regularnightshiftOT_hours			 --20
,regularnightshiftOT_hours * billingregularnightdiffrate as regularnightdiffamt
,regularnightshiftOT_hours * billingregularnightdiffrate as regularnightdiffamttotal


,LegalHoliday_Hours	
,LegalHoliday_Hours																--21
,LegalHoliday_Hours *billinglegalholidayrate as legalhoidayamt
,LegalHoliday_Hours *billinglegalholidayrate as legalhoidayamttotal

,LegalHoliday2_Hours
,LegalHoliday2_Hours *billinglegalholidayrate2 as legalholiday2amttotal



,LegalHolidayOT_Hours
,LegalHolidayOT_Hours															--22
,LegalHolidayOT_Hours *	 billinglegalholidayOTrate  as legalholidayotamt
,LegalHolidayOT_Hours *	 billinglegalholidayOTrate  as legalholidayotamttotal

,LegalHolidayND_Hours
,LegalHolidayND_Hours															--23
,LegalHolidayND_Hours *	billinglegalholidayNDrate	as legalholidayndamt
,LegalHolidayND_Hours *	billinglegalholidayNDrate	as legalholidayndamttotal

,lhotndh																		--24
,lhotndh																		--24
,lhotndh * billinglhotndrate  as lhotndamt
,lhotndh * billinglhotndrate  as lhotndamttotal

,Holiday_Special_Hours
,Holiday_Special_Hours															--25
,Holiday_Special_Hours	* billingspecialholidayrate as specialholidayamt		--25
,Holiday_Special_Hours	* billingspecialholidayrate as specialholidayamttotal		--25

, specialholiday2_hours
, Holiday_Special_Hours	* billingspecialholidayrate2 as specialholiday2amttotal 


,Holiday_SpecialOT_Hours
,Holiday_SpecialOT_Hours														--26
,Holiday_SpecialOT_Hours * billingspecialholidayOTrate as specialholidayotamt
,Holiday_SpecialOT_Hours * billingspecialholidayOTrate as specialholidayotamttotal


,Holiday_SpecialND_Hours  
,Holiday_SpecialND_Hours     														--27
,Holiday_SpecialND_Hours * billingspecialholidaynightdiffrate  as specialholidayndotamt  					--27
,Holiday_SpecialND_Hours * billingspecialholidaynightdiffrate as  specialholidayndotamttotal   				--27

,shotndh
,shotndh																		--28
,shotndh *	billingshotndrate as shotndamt
,shotndh *	billingshotndrate as shotndamttotal

,WDOhours
,WDOhours																		--29
,WDOhours * billingWDOrate as wdoamt
,WDOhours * billingWDOrate as wdoamttotal



,RDhours

,RDothours
,RDothours																		--30
,RDothours * billingrdotrate as wdordamt
,RDothours * billingrdotrate as wdordamttotal

,rdndhours
,rdndhours																		--31
,rdndhours *billingrdndrate as wdordndamt
,rdndhours *billingrdndrate as wdordndamttotal

,lhwdohours	
,lhwdohours																		 --32
,lhwdohours	* billingLHWDORATE	as lhwdoamt
,lhwdohours	* billingLHWDORATE	as lhwdoamttotal

,lhwdoothours
,lhwdoothours																	--33
,lhwdoothours *	billingLHWDOOTRATE	as lhwdootamt
,lhwdoothours *	billingLHWDOOTRATE	as lhwdootamttotal

,lhwdondhours
,lhwdondhours																	--34
,lhwdondhours *	billingLHWDONDRATE	 as lhwdondamt
,lhwdondhours *	billingLHWDONDRATE	 as lhwdondamttotal

,lhwdondothours
,lhwdondothours																	--35
,lhwdondothours	* billingLHWDOOTNDRATE	 as lhwdootndamt
,lhwdondothours	* billingLHWDOOTNDRATE	 as lhwdootndamttotal

,shwdohours
,shwdohours												--36
,shwdohours * billingWDOSHRATE  as shwdoamt
,shwdohours * billingWDOSHRATE  as shwdoamttotal

,shwdoothours
,shwdoothours											--37
,shwdoothours *	billingWDOSHOTRATE as shwdootamt
,shwdoothours *	billingWDOSHOTRATE as shwdoottamttotal

,shwdondhours
,shwdondhours											--38
,shwdondhours * billingWDOSHNDRATE  as shwdondtotalamt
,shwdondhours * billingWDOSHNDRATE  as shwdondtotalamttotal

,shwdondothours
,shwdondothours									--39
,shwdondothours	* billingWDOSHOTNDRATE as shwdootndamt
,shwdondothours	* billingWDOSHOTNDRATE as shwdootndamttotal


,'Processed' AS billingstatus
-- take note of this special case of aldex 
, CASE
        WHEN idclientp = 159 THEN departmentdesc2 -- if aldex get department assign 
        ELSE groupnamenew	 -- else get this field modified in editing billing process2 
    END AS departmentdesc2

,sheetnamenew
,client_branch_position.BillingDepartment
,client.adminfee
,client.vat
,client.ewt
,client_branch_position.billinghourlyrate  

,client_branch_position.billingregularOTrate  
,client_branch_position.billingregularnightdiffrate  
,client_branch_position.billingnightdiffrate  

,client_branch_position.billinglegalholidayrate  
,client_branch_position.billinglegalholidayOTrate  
,client_branch_position.billinglegalholidayNDrate  
,client_branch_position.billinglhotndrate  


,client_branch_position.legalholidayrate2 --get from payroll 
,client_branch_position.billinglegalholidayrate2 



,client_branch_position.billingspecialholidayrate  
,client_branch_position.billingspecialholidayOTrate  
,client_branch_position.billingspecialholidaynightdiffrate  
,client_branch_position.billingshotndrate 

,client_branch_position.specialholidayrate2 --get from payroll 
,client_branch_position.billingspecialholidayrate2

 



,client_branch_position.billingWDOrate  


,client_branch_position.billingrdrate  
,client_branch_position.billingrdotrate  
,client_branch_position.billingrdndrate  
,client_branch_position.billingrdndotrate  

,client_branch_position.billingLHWDORATE  
,client_branch_position.billingLHWDOOTRATE  
,client_branch_position.billingLHWDONDRATE  
,client_branch_position.billingLHWDOOTNDRATE 

,client_branch_position.billingWDOSHRATE  
,client_branch_position.billingWDOSHOTRATE 
,client_branch_position.billingWDOSHNDRATE 
,client_branch_position.billingWDOSHOTNDRATE
,payroll_summary.fixrate
,payroll_summary.dailyratedivisor

,CASE  
    WHEN payroll_summary.fixrate = 'Y' THEN client_branch_position.fixmonthlyrate   
    WHEN payroll_summary.fixrate = 'N' THEN cast(client_branch_position.dailyratepayroll as float)*cast(client_branch_position.divisorfactor as float)
END AS monthlyrates

,CASE  
    WHEN payroll_summary.fixrate = 'Y' THEN client_branch_position.fixmonthlyrate   
    WHEN payroll_summary.fixrate = 'N' THEN cast(client_branch_position.dailyratepayroll as float)*cast(client_branch_position.divisorfactor as float)
END AS fixmonthlyrate2


,client.templateuse
,@uname
,@dcreated
,Tardiness_Hours
,Tardiness_Hours as totalthours	 -- totalhours tardiness

,payroll_summary.dailyrate_payroll
,payroll_summary.regularOTrate
,payroll_summary.nightdiffrate
,payroll_summary.regularnightshiftOTrate
,payroll_summary.legalholidayrate,payroll_summary.legalholidayOTrate,payroll_summary.legalholidayNDrate,payroll_summary.lhotndrate
,payroll_summary.specialholidayrate,payroll_summary.specialholidayOTrate,payroll_summary.specialholidaynightdiffrate,payroll_summary.shotndrate
,payroll_summary.WDOrate
,payroll_summary.RDrate, payroll_summary.RDotrate,payroll_summary.rdndrate
,payroll_summary.lhwdorate,payroll_summary.lhwdootrate,payroll_summary.lhwdondrate,payroll_summary.lhwdondotrate
,payroll_summary.shwdorate,payroll_summary.shwdootrate,payroll_summary.shwdondrate,payroll_summary.shwdondotrate
,payroll_summary.contributionSSSEE,contributionSSSER,contributionSSSEEpro,contributionSSSERpro,contributionSSSECC
,payroll_summary.contributionphilhealthEE,contributionphilhealthER
,payroll_summary.contributionPagibigEE,contributionPagibigER
, CAST(contributionSSSEE as float)+ cast(contributionSSSECC as float)	+ cast(contributionphilhealthEE as float) +	contributionPagibigEE
,othermandatorybasis
,basic
,absences
,absencesdays
,cast(dailyrate_payroll as float) /8/60 * cast(Tardiness_Hours as float) --Tardiness amount 
,cast(dailyrate_payroll as float) /8/60 * cast(Tardiness_Hours as float) --Tardiness total amount 
,basicforsss
,payrollmonth
,client_branch_position.billingdailyratepayroll
,payroll_summary.incomeadjustmentp
,payroll_summary.allowancep
,payroll_summary.incomeadjustmentnbp
,payroll_summary.allowancenbp
,uniformp
,nameplatep
,silp
,thirteenmonth





 
FROM            client INNER JOIN
                         payroll_summary ON client.idclient = payroll_summary.idclientp INNER JOIN
                         client_branch_position ON payroll_summary.idbranchpositionp = client_branch_position.idbranchposition  		

WHERE        (payroll_summary.idpayrollsum = @idpayroll)  



--other deduction/charges 
--UPDATE       BILLINGTABLE
--SET                otherchargesbilling = otherdeduction.amount
--FROM            otherdeduction INNER JOIN
--                         BILLINGTABLE ON otherdeduction.idpayrollsum = BILLINGTABLE.idpayrollsum
--WHERE        (BILLINGTABLE.billingreference = @billingreference) and codeotherdeduction = 250.12

--other charges
UPDATE       BILLINGTABLE
SET                otherchargesbilling = tbl_timekeep.subtotal1
FROM            BILLINGTABLE INNER JOIN
                         tbl_timekeep ON BILLINGTABLE.Employee_id = tbl_timekeep.employeeid AND BILLINGTABLE.Date_Start = tbl_timekeep.datestart
WHERE       (BILLINGTABLE.idpayrollsum = @idpayroll)



---HMO
UPDATE       BILLINGTABLE
SET                hmobilling = otherdeduction.amount
FROM            otherdeduction INNER JOIN
                         BILLINGTABLE ON otherdeduction.idpayrollsum = BILLINGTABLE.idpayrollsum
WHERE        (BILLINGTABLE.billingreference = @billingreference) and codeotherdeduction = 250.13



----uniform
--UPDATE       BILLINGTABLE
--SET                uniformbilling = tbl_timekeep.uniformshortage
--FROM            BILLINGTABLE INNER JOIN
--                         tbl_timekeep ON BILLINGTABLE.Employee_id = tbl_timekeep.employeeid AND BILLINGTABLE.Date_Start = tbl_timekeep.datestart
--WHERE       (BILLINGTABLE.idpayrollsum = @idpayroll)


--namplate
UPDATE       BILLINGTABLE
SET                nameplatebilling = tbl_timekeep.nameplate
FROM            BILLINGTABLE INNER JOIN
                         tbl_timekeep ON BILLINGTABLE.Employee_id = tbl_timekeep.employeeid AND BILLINGTABLE.Date_Start = tbl_timekeep.datestart
WHERE       (BILLINGTABLE.idpayrollsum = @idpayroll)





----name plate
--UPDATE       BILLINGTABLE
--SET                nameplatebilling = otherdeduction.amount
--FROM            otherdeduction INNER JOIN
--                         BILLINGTABLE ON otherdeduction.idpayrollsum = BILLINGTABLE.idpayrollsum
--WHERE        (BILLINGTABLE.idpayrollsum = @idpayroll) and codeotherdeduction = 250.11

----hmo
--UPDATE       BILLINGTABLE
--SET                hmobilling = otherdeduction.amount
--FROM            otherdeduction INNER JOIN
--                         BILLINGTABLE ON otherdeduction.idpayrollsum = BILLINGTABLE.idpayrollsum
--WHERE        (BILLINGTABLE.idpayrollsum = @idpayroll) and codeotherdeduction = 250.13



update payroll_summary 
set transfertoforbillingfinal ='Y'
where idpayrollsum = @idpayroll


END








----------------------------------------------------------- ORIGINALRATE COMPUTATION------------------------------	for  astoria
--ELSE 

--BEGIN 

--INSERT INTO BILLINGTABLE
--(employeename		--1
--,fname2
--,lname2
--,mname2
--,idbranchpositionp	-- 2
--,jobposition2		--3
--,departmentdesc2	--4
--,idbillingreference
--,billingreference	--5
--,idpayrollsum		--6
--, Employee_id		--7
--, Date_Start		--8
--, Date_End			--9
--, noofhourswork1		--10
--, noofhourswork		--10
--, Regular
--, regulartotalamt
--,idclientp			--11
--,idclientbranchp
--,payrolldate	   --12
--,billingdate	   --13
--,signprepared	   --14
--,signapproved	   --15
--,signnoted		   --16
--,signpreparedrole
--,signnotedrole

--,Overtime_Hours1    --18 --othourspayroll
--,Overtime_Hours    --18	 --totalothours
--,Overtime
--,Overtimetotalamt




--,Nightdiff_Hours1   --19
--,Nightdiff_Hours   --19
--,nightdiff
--,nightdifftotalamt

--,regularnightshiftOT_hours1  --20
--,regularnightshiftOT_hours  --20
--,regularnightshiftOT
--,regularnightshiftOTtotalamt

--,LegalHoliday_Hours1		--21
--,LegalHoliday_Hours		--21
--,LegalHoliday
--,LegalHolidaytotalamt

--,LegalHolidayOT_Hours1	--22
--,LegalHolidayOT_Hours	--22
--,LegalHolidayOT
--,LegalHolidayOTtotalamt

--,LegalHolidayND_Hours1	--23
--,LegalHolidayND_Hours	--23
--,LegalHolidayND
--,LegalHolidayNDtotalamt


--,lhotndh1				--24
--,lhotndh				--24
--,lhotnd
--,lhotndtotalamt

--,Holiday_Special_Hours1
--,Holiday_Special_Hours	--25
--,Holiday_Special
--,Holiday_Specialtotalamt


--,Holiday_SpecialOT_Hours1 --26
--,Holiday_SpecialOT_Hours  --26
--,Holiday_SpecialOT
--,Holiday_SpecialOTtotalamt

--,Holiday_Specialnd_Hours1 --27
--,Holiday_Specialnd_Hours  --27
--,Holiday_Specialnd
--,Holiday_Specialndtotalamt

--,shotndh1
--,shotndh				  --28
--,shotnd
--,shotndtotalamt

--,WDOhours1
--,WDOhours				  --29
--,WDO 
--,WDOtotalamt

--,RDothours1				  --30
--,RDothours				  --30
--,RDot
--,RDottotalamt

--,rdndhours1				  --31
--,rdndhours				  --31
--,rdnd
--,rdndtotalamt

--,lhwdohours1				  --32
--,lhwdohours				  --32
--,lhwdo
--,lhwdototalamt

--,lhwdoothours1			  --33
--,lhwdoothours			  --33
--,lhwdoot
--,lhwdoottotalamt

--,lhwdondhours1			  --34
--,lhwdondhours			  --34
--,lhwdond
--,lhwdondtotalamt

--,lhwdootndhours1			  --35
--,lhwdootndhours			  --35
--,lhwdootnd
--,lhwdootndtotalamt

--,wdoshhours1				  --36
--,wdoshhours				  --36
--,wdosh
--,wdoshtotalamt

--,wdoshothours1			  --37
--,wdoshothours			  --37
--,wdoshot
--,wdoshottotalamt


--,wdoshndhours1			  --38
--,wdoshndhours			  --38
--,wdoshnd
--,wdoshndtotalamt

--,wdoshotndhours1	  --39
--,wdoshotndhours		  --39
--,wdoshotnd
--,wdoshotndtotalamt

--,billingstatus
--,BillingGroup
--,billingsheetname
--,BillingDepartment
--,adminfee
--,vat
--,ewt
--,billinghourlyrate  

--,billingregularOTrate  
--,billingregularnightdiffrate  
--,billingnightdiffrate  
--,billinglegalholidayrate  
--,billinglegalholidayOTrate  
--,billinglegalholidayNDrate  
--,billinglhotndrate  
--,billingspecialholidayrate  
--,billingspecialholidayOTrate  
--,billingspecialholidaynightdiffrate  
--,billingshotndrate  
--,billingWDOrate  
--,billingrdotrate  
--,billingrdndrate  
--,billingLHWDORATE  
--,billingLHWDOOTRATE  
--,billingLHWDONDRATE  
--,billingLHWDOOTNDRATE 
--,billingWDOSHRATE  
--,billingWDOSHOTRATE 
--,billingWDOSHNDRATE 
--,billingWDOSHOTNDRATE
--,fixrate
--,dailyratedivisor
--,monthlyrates
--,fixmonthlyrate
--,templateuse
--,bcreatedby
--,bcreateddate
--,Tardiness_Hours

--,dailyrate_payroll --payrollrate Start
--,regularOTrate 

--,nightdiffrate
--,regularnightshiftOTrate
--,legalholidayrate,legalholidayOTrate,legalholidayNDrate,lhotndrate
--,specialholidayrate,specialholidayOTrate,specialholidaynightdiffrate,shotndrate
--,WDOrate,RDotrate,rdndrate
--,lhwdorate,lhwdootrate,lhwdondrate,lhwdootndrate
--,wdoshrate,wdoshotrate,wdoshndrate,wdoshotndrate
--,contributionSSSEE,contributionSSSER,contributionSSSEEpro,contributionSSSERpro,contributionSSSECC
--,contributionphilhealthEE,contributionphilhealthER
--,contributionPagibigEE,contributionPagibigER
--,totalmandatory
--,othermandatorybasis
--,basic
--,absences
--,Tardiness
--,tardinesstotal
--,previoussssbasis	
--,payrollmonth
--,dailyrate_billing
--,incomeadjustment
--,billingallowance
--,uniformbilling
--,nameplatebilling




--)  
--SELECT        
--payroll_summary.lname2 + N', ' + payroll_summary.fname2 + N'  ' + payroll_summary.mname2 AS EmployeeName   --1
--,fname2
--,lname2
--,mname2
--,idbranchpositionp					--2
--, client_branch_position.jobposition		--3
--, payroll_summary.departmentdesc2	--4
--, @idbillingrefererence
--, @billingreference AS Expr1		--5
--, payroll_summary.idpayrollsum		--6
--, payroll_summary.Employee_id		--7
--, payroll_summary.Date_Start		--8
--, payroll_summary.Date_End			--9


--,CASE  
--    --WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2)	--10
--	WHEN payroll_summary.fixrate = 'Y' THEN noofhourswork 
--    WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
--END AS noofhoursworok1

--,CASE  
--    --WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13-absencesdays, 0) * 8-(Tardiness_Hours/60), 2) --10
--	WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
--    WHEN payroll_summary.fixrate = 'N' THEN noofhourswork 
--END AS noofhoursworok2


----, payroll_summary.noofhourswork1 *billinghourlyrate as regularamt
----, payroll_summary.noofhourswork2 *billinghourlyrate as regularamttotal


---- Calculate regular amount
--,    CASE  
--      --  WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13 - payroll_summary.absencesdays, 0) * 8-(Tardiness_Hours/60), 2) * billinghourlyrate
--		WHEN payroll_summary.fixrate = 'Y' THEN basic
--        WHEN payroll_summary.fixrate = 'N' THEN basic
--    END AS regularamt

--    -- Calculate total regular amount
--,    CASE  
--        --WHEN payroll_summary.fixrate = 'Y' THEN ROUND(COALESCE(13 - payroll_summary.absencesdays, 0) * 8-(Tardiness_Hours/60), 2) * billinghourlyrate
--		WHEN payroll_summary.fixrate = 'Y' THEN basic
--		WHEN payroll_summary.fixrate = 'N' THEN basic
--    END AS regularamttotal

	

--, payroll_summary.idclientp			--11
--,payroll_summary.idclientbranchp
--, payroll_summary.payrolldate		--12
--, @billingdate AS billdate			--13
--, 'client.billingpreparedby'				--14
--, 'client.billingpreparedby'				--15
--, 'client.billingnotedby'					--16
--, 'client.billingpreparedbyrole'
--, 'client.billingnotedbyrole'

--,Overtime_Hours						--18
--,Overtime_Hours						--18
--,Overtime
--,Overtime	-- total





--,Nightdiff_Hours 
--,Nightdiff_Hours 					--19
--,Nightdiff
--,Nightdiff	-- total

										 										 
--,regularnightshiftOT_hours			 --20
--,regularnightshiftOT_hours			 --20
--,regularnightshiftOT
--,regularnightshiftOT



--,LegalHoliday_Hours	
--,LegalHoliday_Hours																--21
--,LegalHoliday
--,LegalHoliday -- totalamount   


--,LegalHolidayOT_Hours
--,LegalHolidayOT_Hours															--22
--,LegalHolidayOT
--,LegalHolidayOT

--,LegalHolidayND_Hours
--,LegalHolidayND_Hours															--23
--,LegalHolidayND
--,LegalHolidayND
			   
--,lhotndh																		--24
--,lhotndh																		--24
--,lhotnd
--,lhotnd

--,Holiday_Special_Hours
--,Holiday_Special_Hours															--25
--,Holiday_Special
--,Holiday_Special


--,Holiday_SpecialOT_Hours
--,Holiday_SpecialOT_Hours														--26
--,Holiday_SpecialOT
--,Holiday_SpecialOT

--,SHNightdiffOT_Hours  
--,SHNightdiffOT_Hours     														--27
--,Holiday_Specialnightdiff	
--,Holiday_Specialnightdiff


--,shotndh
--,shotndh																		--28
--,shotnd
--,shotnd
	   	   
--,WDOhours
--,WDOhours																		--29
--,wdo
--,wdo

	   
--,RDothours
--,RDothours																		--30
--,RDot
--,RDot


--,rdndhours
--,rdndhours																		--31
--,rdnd
--,rdnd


--,lhwdohours	
--,lhwdohours																		 --32
--,lhwdo
--,lhwdo
   
--,lhwdoothours
--,lhwdoothours																	--33
--,lhwdoot
--,lhwdoot


--,lhwdondhours
--,lhwdondhours																	--34
--,lhwdond
--,lhwdond
			   
--,lhwdondothours
--,lhwdondothours																	--35
--,lhwdondot
--,lhwdondot

--,shwdohours
--,shwdohours												--36
--,shwdo
--,shwdo
	  
--,shwdoothours
--,shwdoothours											--37
--,shwdoot
--,shwdoot

--,shwdondhours
--,shwdondhours											--38
--,shwdond
--,shwdond


--,shwdondothours
--,shwdondothours									--39
--,shwdondot
--,shwdondot


--,'Processed' AS billingstatus
--,groupnamenew
--,sheetnamenew
--,client_branch_position.BillingDepartment
--,client.adminfee
--,client.vat
--,client.ewt
--,client_branch_position.billinghourlyrate  

--,client_branch_position.billingregularOTrate  
--,client_branch_position.billingregularnightdiffrate  
--,client_branch_position.billingnightdiffrate  
--,client_branch_position.billinglegalholidayrate  
--,client_branch_position.billinglegalholidayOTrate  
--,client_branch_position.billinglegalholidayNDrate  
--,client_branch_position.billinglhotndrate  
--,client_branch_position.billingspecialholidayrate  
--,client_branch_position.billingspecialholidayOTrate  
--,client_branch_position.billingspecialholidaynightdiffrate  
--,client_branch_position.billingshotndrate  
--,client_branch_position.billingWDOrate  
--,client_branch_position.billingrdotrate  
--,client_branch_position.billingrdndrate  

--,client_branch_position.billingLHWDORATE  
--,client_branch_position.billingLHWDOOTRATE  
--,client_branch_position.billingLHWDONDRATE  
--,client_branch_position.billingLHWDOOTNDRATE 

--,client_branch_position.billingWDOSHRATE  
--,client_branch_position.billingWDOSHOTRATE 
--,client_branch_position.billingWDOSHNDRATE 
--,client_branch_position.billingWDOSHOTNDRATE
--,payroll_summary.fixrate
--,payroll_summary.dailyratedivisor

--,CASE  
--    WHEN payroll_summary.fixrate = 'Y' THEN client_branch_position.fixmonthlyrate   
--    WHEN payroll_summary.fixrate = 'N' THEN client_branch_position.fixmonthlyrate 
--END AS monthlyrates

--,CASE  
--    WHEN payroll_summary.fixrate = 'Y' THEN client_branch_position.fixmonthlyrate   
--    WHEN payroll_summary.fixrate = 'N' THEN client_branch_position.fixmonthlyrate 
--END AS fixmonthlyrate2


--,client.templateuse
--,@uname
--,@dcreated
--,Tardiness_Hours

--,payroll_summary.dailyrate_payroll
--,payroll_summary.regularOTrate

--,payroll_summary.nightdiffrate
--,payroll_summary.regularnightshiftOTrate
--,payroll_summary.legalholidayrate,payroll_summary.legalholidayOTrate,payroll_summary.legalholidayNDrate,payroll_summary.lhotndrate
--,payroll_summary.specialholidayrate,payroll_summary.specialholidayOTrate,payroll_summary.specialholidaynightdiffrate,payroll_summary.shotndrate
--,payroll_summary.WDOrate,payroll_summary.RDotrate,payroll_summary.rdndrate
--,payroll_summary.lhwdorate,payroll_summary.lhwdootrate,payroll_summary.lhwdondrate,payroll_summary.lhwdondotrate
--,payroll_summary.shwdorate,payroll_summary.shwdootrate,payroll_summary.shwdondrate,payroll_summary.shwdondotrate
--,payroll_summary.contributionSSSEE,contributionSSSER,contributionSSSEEpro,contributionSSSERpro,contributionSSSECC
--,payroll_summary.contributionphilhealthEE,contributionphilhealthER
--,payroll_summary.contributionPagibigEE,contributionPagibigER
--, CAST(contributionSSSEE as float)+ cast(contributionSSSECC as float)	+ cast(contributionphilhealthEE as float) +	contributionPagibigEE
--,othermandatorybasis
--,basic
--,absences
--,cast(Tardiness_Hours as float) /60 * cast(client_branch_position.billingtardinessrate as float) --Tardiness amount 
--,cast(Tardiness_Hours as float) /60 * cast(client_branch_position.billingtardinessrate as float) --Tardiness total amount 
--,basicforsss
--,payrollmonth
--,client_branch_position.billingdailyratepayroll
--,payroll_summary.incomeadjustmentp
--,payroll_summary.allowancep
--,uniformp
--,nameplatep

----,((CAST(monthly AS FLOAT) / 2) / CAST(divisorfactor AS FLOAT))	-- tardiness rate


 
--FROM            client INNER JOIN
--                         payroll_summary ON client.idclient = payroll_summary.idclientp INNER JOIN
--                         client_branch_position ON payroll_summary.idbranchpositionp = client_branch_position.idbranchposition  						 

--WHERE        (payroll_summary.idpayrollsum = @idpayroll) 

--END






-- update payroll_summary 
--set transfertoforbillingfinal ='Y'
--where idpayrollsum = @idpayroll

--update BILLINGTABLE
--set total =	 
--  ROUND(COALESCE(regulartotalamt,0)+ 0.00001, 2)  --1
--+ ROUND(COALESCE(Overtimetotalamt,0)  + 0.00001, 2)	--2

--+ ROUND(COALESCE(nightdifftotalamt,0)+ 0.00001, 2)	 --4
--+ ROUND(COALESCE(regularnightshiftOTtotalamt,0)+ 0.00001, 2)  --5
--+ ROUND(COALESCE(LegalHolidaytotalamt,0)+ 0.00001, 2) 	--6
--+ ROUND(COALESCE(LegalHolidayOTtotalamt,0)+ 0.00001, 2) --7 
--+ ROUND(COALESCE(LegalHolidayNDtotalamt,0)+ 0.00001, 2) --8
--+ ROUND(COALESCE(lhotndtotalamt,0)+ 0.00001, 2) --9
--+ ROUND(COALESCE(Holiday_Specialtotalamt,0)+ 0.00001, 2) --10
--+ ROUND(COALESCE(Holiday_SpecialOTtotalamt,0)+ 0.00001, 2) --11
--+ ROUND(COALESCE(Holiday_Specialndtotalamt,0)+ 0.00001, 2) --12
--+ ROUND(COALESCE(shotndtotalamt,0)+ 0.00001, 2) --13
--+ ROUND(COALESCE(WDOtotalamt,0)+ 0.00001, 2) --14
--+ ROUND(COALESCE(RDottotalamt,0)+ 0.00001, 2) --15
--+ ROUND(COALESCE(rdndtotalamt,0)+ 0.00001, 2) --16
--+ ROUND(COALESCE(lhwdototalamt,0)+ 0.00001, 2) --17
--+ ROUND(COALESCE(lhwdoottotalamt,0)+ 0.00001, 2) --17
--+ ROUND(COALESCE(lhwdondtotalamt,0)+ 0.00001, 2) --18
--+ ROUND(COALESCE(lhwdootndtotalamt,0)+ 0.00001, 2) --19
--+ ROUND(COALESCE(wdoshtotalamt,0)+ 0.00001, 2) --20
--+ ROUND(COALESCE(wdoshottotalamt,0)+ 0.00001, 2) --21
--+ ROUND(COALESCE(wdoshndtotalamt,0)+ 0.00001, 2) --22
--+ ROUND(COALESCE(wdoshotndtotalamt,0)+ 0.00001, 2)   --23 
--where billingreference = @billingreference  and idpayrollsum = @idpayroll


--UPDATE    BILLINGTABLE 
--SET        trxallowance = adjustment.amount
--FROM       BILLINGTABLE INNER JOIN
--                         adjustment ON BILLINGTABLE.idpayrollsum = adjustment.idpayrollsum
--WHERE        (adjustment.particular = 'Meal Allowance') AND billingreference = @billingreference  and BILLINGTABLE.idpayrollsum = @idpayroll



----other charges
--UPDATE       BILLINGTABLE
--SET                otherchargesbilling = tbl_timekeep.subtotal1
--FROM            BILLINGTABLE INNER JOIN
--                         tbl_timekeep ON BILLINGTABLE.Employee_id = tbl_timekeep.employeeid AND BILLINGTABLE.Date_Start = tbl_timekeep.datestart
--WHERE       (BILLINGTABLE.idpayrollsum = @idpayroll)





-----HMO
--UPDATE       BILLINGTABLE
--SET                hmobilling = otherdeduction.amount
--FROM            otherdeduction INNER JOIN
--                         BILLINGTABLE ON otherdeduction.idpayrollsum = BILLINGTABLE.idpayrollsum
--WHERE        (BILLINGTABLE.billingreference = @billingreference) and codeotherdeduction = 250.13



----uniform
--UPDATE       BILLINGTABLE
--SET                uniformbilling = tbl_timekeep.uniformshortage
--FROM            BILLINGTABLE INNER JOIN
--                         tbl_timekeep ON BILLINGTABLE.Employee_id = tbl_timekeep.employeeid AND BILLINGTABLE.Date_Start = tbl_timekeep.datestart
--WHERE       (BILLINGTABLE.idpayrollsum = @idpayroll)

----namplate
--UPDATE       BILLINGTABLE
--SET                nameplatebilling = tbl_timekeep.nameplate
--FROM            BILLINGTABLE INNER JOIN
--                         tbl_timekeep ON BILLINGTABLE.Employee_id = tbl_timekeep.employeeid AND BILLINGTABLE.Date_Start = tbl_timekeep.datestart
--WHERE       (BILLINGTABLE.idpayrollsum = @idpayroll)





COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;

        -- Optional: Handle the error (log it, raise it, etc.)
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrorMessage, 16, 1);
    END CATCH

		
END 

