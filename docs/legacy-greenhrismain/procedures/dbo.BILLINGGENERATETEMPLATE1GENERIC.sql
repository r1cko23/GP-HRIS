-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2023>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
CREATE PROCEDURE [dbo].[BILLINGGENERATETEMPLATE1GENERIC]
@billingreference nvarchar(20),
@idclient int

AS	
BEGIN
SET NOCOUNT ON;
  
 
INSERT INTO tbl_Bill_TemplateData (
billingreference			--1
,IDbilling
,department					--2
,position					--3
,EmployeeName				--4
,dailyrate
,Reg_Rate					--5
,Reg_Hours					--6
,CoverUp_Overtime_Rate		--7
,CoverUp_Overtime_Hours		--8
,Reg_OT_Rate				--9
,Reg_OT_Hours				--10
,ND_Rate					--11
,ND_Hours					--12
,Reg_ND_OT_Rate				--13
,Reg_ND_OT_Hours 			--14
,LH_Rate					--15
,LH_Hours					--16
,LH_OT_Rate					--17
,LH_OT_Hours 				--18
,LH_ND_Rate					--19
,LH_ND_Hours  				--20
,LH_OT_ND_Rate				--21
,LH_OT_ND_Hours				--22
,SH_Rate					--23
,SH_Hours					--24
,SH_OT_Rate					--25
,SH_OT_Hours 				--26
,SH_ND_Rate					--27
,SH_ND_Hours 			    --28
,SH_OT_ND_Rate				--29
,SH_OT_ND_Hours				--30

,WDO_RD_RATE		--31
,WDO_RD_Hours 				--32


,WDO_RD_OT_Rate	 			--33
,WDO_RD_OT_Hours  			--34
,WDO_RD_ND_Rate				--35
,WDO_RD_ND_Hours 			--36


 ,WDOHOURS
 ,WDORATE

,LH_WDO_Rate
,LH_WDO_Hours

,LH_WDO_OT_Rate
,LH_WDO_OT_Hours

,LH_WDO_ND_Rate
,LH_WDO_ND_Hours

,LH_WDO_OT_ND_Rate
,LH_WDO_OT_ND_Hours

,SH_WDO_Rate
,SH_WDO_Hours

,SH_WDO_OT_Rate
,SH_WDO_OT_Hours

,SH_WDO_ND_Rate
,SH_WDO_ND_Hours

,SH_WDO_OTND_Rate
,SH_WDO_OTND_Hours

,BillingGroup
,billingsheetname
,contributionSSSEE
,contributionSSSEEpro
,contributionSSSER
,contributionSSSERpro
,contributionSSSECC
,contributionphilhealthER
,contributionPagibigER
,uniformbilling
,nameplatebilling
,hmobilling
,incomeadjustment
,othercharges
,allowance
,allowancenb
,incomeadjustmentnb

)

SELECT        
  BILLINGTABLE.billingreference											--1
  ,IDBILLING
, BILLINGTABLE.departmentdesc2 AS Department							--2
, BILLINGTABLE.jobposition2 AS Position									--3
, BILLINGTABLE.employeename												--4
, BILLINGTABLE.dailyrate_payroll as dailyrate
, BILLINGTABLE.billinghourlyrate AS Reg_Rate							--5
, BILLINGTABLE.noofhourswork AS Reg_Hours								--6
, BILLINGTABLE.billingcoverupovertimerate AS CoverUp_Overtime_Rate		--7
, BILLINGTABLE.coverupothours as CoverUp_Overtime_Hours					--8
, BILLINGTABLE.billingregularOTrate AS  Reg_OT_Rate						--9
, BILLINGTABLE.Overtime_Hours as Reg_OT_Hours							--10
, BILLINGTABLE.billingnightdiffrate AS  ND_Rate							--11
, BILLINGTABLE.Nightdiff_Hours as ND_Hours								--12
, BILLINGTABLE.billingregularnightdiffrate AS  Reg_ND_OT_Rate			--13
, BILLINGTABLE.regularnightshiftOT_hours as Reg_ND_OT_Hours				--14
, BILLINGTABLE.billinglegalholidayrate AS  LH_Rate						--15
, BILLINGTABLE.LegalHoliday_Hours as LH_Hours						    --16
, BILLINGTABLE.billinglegalholidayOTrate AS  LH_OT_Rate					--17
, BILLINGTABLE.LegalHolidayOT_Hours as LH_OT_Hours						--18
, BILLINGTABLE.billinglegalholidayNDrate AS  LH_ND_Rate					--19
, BILLINGTABLE.LegalHolidayND_Hours as LH_ND_Hours						--20
, BILLINGTABLE.billinglhotndrate AS  LH_OT_ND_Rate						--21
, BILLINGTABLE.lhotndh as LH_OT_ND_Hours								--22
, BILLINGTABLE.billingspecialholidayrate AS  SH_Rate					--23
, BILLINGTABLE.Holiday_Special_Hours as SH_Hours						--24
, BILLINGTABLE.billingspecialholidayOTrate AS  SH_OT_Rate				--25
, BILLINGTABLE.Holiday_SpecialOT_Hours as SH_OT_Hours					--26
, BILLINGTABLE.billingspecialholidaynightdiffrate AS  SH_ND_Rate		--27
, BILLINGTABLE.Holiday_SpecialND_Hours as SH_ND_Hours					--28
, BILLINGTABLE.billingshotndrate AS  SH_OT_ND_Rate						--29
, BILLINGTABLE.shotndh as SH_OT_ND_Hours	
																		--30
, BILLINGTABLE.billingrdrate AS RDRATE							--31
, BILLINGTABLE.RDhours aS RD_HOURS		

--32
, BILLINGTABLE.billingrdotrate AS  WDO_RD_OT_Rate						--33
, BILLINGTABLE.RDothours as WDO_RD_OT_Hours								--34

, BILLINGTABLE.billingrdndrate AS  WDO_RD_ND_Rate						--35
, BILLINGTABLE.rdndhours as WDO_RD_ND_Hours								--36


,BILLINGTABLE.WDOhours
,BILLINGTABLE.billingWDOrate


, BILLINGTABLE.billingLHWDORATE AS  LH_WDO_Rate
, BILLINGTABLE.lhwdohours as LH_WDO_Hours

, BILLINGTABLE.billingLHWDOOTRATE AS  LH_WDO_OT_Rate
, BILLINGTABLE.lhwdoothours as LH_WDO_OT_Hours

, BILLINGTABLE.billingLHWDONDRATE AS  LH_WDO_ND_Rate
, BILLINGTABLE.lhwdondhours as LH_WDO_ND_Hours

, BILLINGTABLE.billingLHWDOOTNDRATE AS  LH_WDO_OT_ND_Rate
, BILLINGTABLE.lhwdootndhours as LH_WDO_OT_ND_Hours

, BILLINGTABLE.billingWDOSHRATE AS  SH_WDO_Rate
, BILLINGTABLE.wdoshhours as SH_WDO_Hours

, BILLINGTABLE.billingWDOSHOTRATE AS  SH_WDO_OT_Rate
, BILLINGTABLE.wdoshothours as SH_WDO_OT_Hours

, BILLINGTABLE.billingWDOSHNDRATE AS  SH_WDO_ND_Rate
, BILLINGTABLE.wdoshndhours as SH_WDO_ND_Hours

, BILLINGTABLE.billingWDOSHOTNDRATE AS  SH_WDO_OTND_Rate
, BILLINGTABLE.wdoshotndhours as SH_WDO_OTND_Hours
, CAST(BILLINGTABLE.BillingGroup AS VARCHAR(50)) + '|' + 
  CAST(BILLINGTABLE.billinghourlyrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingcoverupovertimerate AS VARCHAR(10)) + '|'   
+ CAST(BILLINGTABLE.billingregularOTrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingnightdiffrate AS VARCHAR(10)) + '|'   
+ CAST(BILLINGTABLE.billingregularnightdiffrate AS VARCHAR(10)) + '|'   
+ CAST(BILLINGTABLE.billingregularnightdiffrate AS VARCHAR(10)) + '|'  
+ CAST(BILLINGTABLE.billinglegalholidayrate AS VARCHAR(10)) + '|'  
+ CAST(BILLINGTABLE.billinglegalholidayOTrate AS VARCHAR(10)) + '|'  
+ CAST(BILLINGTABLE.billinglegalholidayNDrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billinglhotndrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingspecialholidayrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingspecialholidayOTrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingspecialholidaynightdiffrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingshotndrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingWDOrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingrdotrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingrdndrate AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingLHWDORATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingLHWDOOTRATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingLHWDONDRATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingLHWDOOTNDRATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingWDOSHRATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingWDOSHOTRATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingWDOSHNDRATE AS VARCHAR(10)) + '|'
+ CAST(BILLINGTABLE.billingWDOSHOTNDRATE AS VARCHAR(10)) + '|'

AS BillingGroup_Concat1
,billingsheetname
,BILLINGTABLE.contributionSSSEE
,BILLINGTABLE.contributionSSSEEpro
,BILLINGTABLE.contributionSSSER
,BILLINGTABLE.contributionSSSERpro		   
,contributionSSSECC
,BILLINGTABLE.contributionphilhealthER
,BILLINGTABLE.contributionPagibigER
,uniformbilling
,nameplatebilling
,hmobilling
,BILLINGTABLE.incomeadjustment
,otherchargesbilling
,BILLINGTABLE.billingallowance
,BILLINGTABLE.billingallowancenb
,BILLINGTABLE.incomeadjustmentnb
		   



FROM            BILLINGTABLE INNER JOIN
                         GREENHRISMAIN.dbo.client ON BILLINGTABLE.idclientp = client.idclient INNER JOIN
                         GREENHRISMAIN.dbo.client_branch_position ON BILLINGTABLE.idbranchpositionp = client_branch_position.idbranchposition
WHERE        (BILLINGTABLE.billingstatus = N'processed') AND (BILLINGTABLE.billingreference = @billingreference)

DECLARE @JsonResult NVARCHAR(MAX);

SELECT @JsonResult = (Select * from tbl_Bill_TemplateData where billingreference = @billingreference
ORDER BY BillingGroup, Reg_Rate,EmployeeName
FOR JSON PATH, INCLUDE_NULL_VALUES);

SELECT @JsonResult;

		
END 

