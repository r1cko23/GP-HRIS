-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<ALPHALIST Complex>
-- =============================================
CREATE PROCEDURE [dbo].[USP_FORALPHALIST]
--@payrollmonth nvarchar(30),
--@idclient int
--@departmentcodep int,
--@idclientbranchp int
@idemployee int,
@dstart date,
@dend date



AS	

BEGIN

--constant value for testing 
--DECLARE @idclientp int =157
--DECLARE @payrollmonth nvarchar(20) ='November 2023'
--declare @departmentcodep int =213

--declare @idclientlast int
--declare @departmentcodeplast int
--declare @branchcodelast int
--declare @idclientbranchlast int
--declare @idemployee int = 12688
DECLARE @DAILYRATE FLOAT 
DECLARE @SUMTHIRTEENMONTH FLOAT


SET NOCOUNT ON;
 

CREATE TABLE #TempTableforalphalist(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [idpayrollsum] int,
	[Employee_id] int,
	[lname] NVARCHAR(50),
	[fname] NVARCHAR(50),
	[mname] NVARCHAR(50),
	[dailyrate] float,
	[date_start] date,
	[date_end] NVARCHAR(30),
	[basisofsssded] NVARCHAR(20),
	[idclient] int,
	[idclientp] int,
	[payrollmonthyear] NVARCHAR(30),
	[departmentcodep] int, 
	[idclientbranchp] int, 
	[grossamttaxable] float, 
	[netamount] float, 
	[contributionSSSEE] float,
	[contributionPHIEE] float,
	[contributionpagEE] float,
	[wtax] float,
	[Adjustment] float, 
	[basic] float,
	[overtime] float,
	[nightdiff] float,
	[holiday] float,
	[noofhourswork] float,
	[tinno] NVARCHAR(30),
	[thirteenmonth] float

   );


CREATE INDEX idx_empid ON #TempTableforalphalist (Employee_id);
CREATE INDEX idx_idpayrollsum ON #TempTableforalphalist (idpayrollsum);
CREATE INDEX idx_monthyear ON #TempTableforalphalist (payrollmonthyear);
CREATE INDEX idx_lname ON #TempTableforalphalist (lname);
CREATE INDEX idx_clientp ON #TempTableforalphalist (idclientp);

-- Insert data from the payroll_history table into the #TempTable
INSERT INTO #TempTableforalphalist (employee_id
,idpayrollsum
,lname,fname
,mname
,date_start
,date_end
,idclientp
,idclientbranchp
,payrollmonthyear
,departmentcodep
,grossamttaxable
,netamount
,contributionSSSEE
,contributionPHIEE
,contributionpagEE
,wtax
,Adjustment
,basic
,overtime
,nightdiff
,holiday
,noofhourswork
,tinno
)
		
SELECT employee_id
,idpayrollsum
,lname
,fname
,mname
,Date_Start
,Date_End
,idclientp
,idclientbranchp
,payrollmonth
,department_codep
,grossamttaxable --changed to taxable applied to alphalist report only(1-10-2025)
,netamount
,contributionSSSEE
,contributionphilhealthEE
,contributionPagibigEE
,Wtax
,taxableadjustment,basic
,Overtime+LegalHolidayOT+Holiday_SpecialOT+LHONRDOT+SHONRDOT as tovertime -- 5items
,Nightdiff+LegalHolidayND+Holiday_Specialnightdiff+regularnightshiftOT as tnightdiff -- 4 items 
,LegalHoliday+Holiday_Special+RD+wdo as tholiday -- 4 items 
,noofhourswork
,tinno
FROM payrollhistory.dbo.payroll_history
where Employee_id = @idemployee  and Date_Start >= @dstart and Date_End <= @dend
order by lname,fname



--SELECT        client_branch_position.dailyratepayroll
--FROM          Employee INNER JOIN
--              client_branch_position ON Employee.Position1 = client_branch_position.idbranchposition
--where Employee_id = @idemployee

SELECT TOP 1  @dailyrate = client_branch_position.dailyratepayroll 
				FROM Employee INNER JOIN
				client_branch_position ON Employee.Position1 = client_branch_position.idbranchposition
where Employee_id = @idemployee 


SELECT TOP 1  @SUMTHIRTEENMONTH = sum(thirteenmonth)
				FROM PAYROLL_SUMMARY				
where Employee_id = @idemployee  and Date_Start >= @dstart and Date_End <= @dend


update #TempTableforalphalist
set dailyrate = @DAILYRATE
where Employee_id = @idemployee


update #TempTableforalphalist
set thirteenmonth = @SUMTHIRTEENMONTH
where Employee_id = @idemployee  

	   	 
-- Retrieve data from #TempTable
--select * from #TempTableforalphalist 

select client.companyname,* from #TempTableforalphalist
inner join client on #TempTableforalphalist.idclientp = client.idclient
			
-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTableforalphalist;


END

