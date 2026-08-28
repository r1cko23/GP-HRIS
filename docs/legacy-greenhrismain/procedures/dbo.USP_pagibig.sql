-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<SSS Complex>
-- =============================================
CREATE PROCEDURE [dbo].[USP_pagibig]
@payrollmonth nvarchar(30),
@idclient int,
@departmentcodep int,
@idclientbranchp int

--@payoutdate nvarchar(20),
--@iddepartmentx int
AS	

BEGIN

--constant value for testing 
--DECLARE @idclient int =157
--DECLARE @payrollmonth nvarchar(20) ='November 2023'
--declare @departmentcodep int =213

declare @idclientlast int
declare @departmentcodeplast int
declare @branchcodelast int
declare @idclientbranchlast int
declare @idemployeePAG int



SET NOCOUNT ON;
 

CREATE TABLE #TempTablePAG(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [idpayrollsum] int,
	[Employee_id] int,
	[lname] NVARCHAR(50),
	[fname] NVARCHAR(50),
	[mname] NVARCHAR(50),
	[basisofsssded] NVARCHAR(20),
	[idclient] int,
	[idclientp] int,
	[monthyear] NVARCHAR(20),
	[departmentcodep] int, 
	[idclientbranchp] int, 
	[grossamttaxable] float, 
	[contributionpagEE] float,
	[contributionpagER] float,
	[Adjustment] float, 
	[lastbasic] float,
	[pagibigno] NVARCHAR(30),	
	[birthdate] NVARCHAR(20)
   );

-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idx_empid ON #TempTablePAG (Employee_id);
CREATE INDEX idx_idpayrollsum ON #TempTablePAG (idpayrollsum);
CREATE INDEX idx_monthyear ON #TempTablePAG (monthyear);
CREATE INDEX idx_lname ON #TempTablePAG (lname);
CREATE INDEX idx_clientp ON #TempTablePAG (idclientp);


INSERT INTO #TempTablePAG (employee_id,idpayrollsum,lname,fname,mname,basisofsssded,idclient,idclientp,idclientbranchp,monthyear,departmentcodep,grossamttaxable,contributionpagEE,contributionpagER,Adjustment,lastbasic,PAGIBIGno,birthdate)
		
SELECT        employee_id, idpayrollsum, lname, fname,  mname, basisofsssded,idclient,idclientp,idclientbranchp, payrollmonth,department_codep,grossamttaxable,contributionPagibigEE,contributionPagibigER,Adjustment,lastbasic,pagibigno, FORMAT(date_Birth, 'MM/dd/yyyy') AS date_Birth
FROM          FORPAGIBIG
where payrollmonth = @payrollmonth
order by lname,fname


---SET get last idclient 
DECLARE myCursor2 CURSOR FOR

	SELECT employee_id FROM #TempTablePAG where monthyear=@payrollmonth and idclientp <> @idclient
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeePAG
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
		--get last idclientp,department and branch
		 SELECT TOP 1  @idclientlast =  idclientp FROM #TempTablePAG where Employee_id = @idemployeePAG and monthyear = @payrollmonth and  contributionpagEE <>0 order by idpayrollsum desc
		 SELECT TOP 1  @departmentcodeplast =  departmentcodep FROM #TempTablePAG where Employee_id = @idemployeePAG and monthyear = @payrollmonth and  contributionpagEE <>0 order by idpayrollsum desc
		 SELECT TOP 1  @idclientbranchlast =  idclientbranchp FROM #TempTablePAG where Employee_id = @idemployeePAG and monthyear = @payrollmonth and  contributionpagEE <>0 order by idpayrollsum desc


		--update  as per request of mam lea not to consolidate 2-7-2025
		--update #TempTablePAG
		--set idclientp = @idclientlast,
		--departmentcodep = @departmentcodeplast,
		--idclientbranchp = @idclientbranchlast		
		--Where Employee_id = @idemployeePAG


		FETCH NEXT FROM myCursor2 INTO @idemployeePAG
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2    
	   	 
-- Retrieve data from #TempTable
--SELECT * FROM #TempTableSSS  
--where idclientp = @idclient
--order by lname



--SELECT        #TempTablePAG.*, client.companyname,Department.Department_desc,client_branch.branch
--FROM            #TempTablePAG
--                         INNER JOIN client ON #TempTablePAG.idclientp = client.idclient
--						 INNER JOIN Department ON #TempTablePAG.departmentcodep = Department.iddepartment
--						 INNER JOIN client_branch ON #TempTablePAG.idclientbranchp = client_branch.idclientbranch						 
--						 where  (@idclient = 0 OR idclientp = @idclient)
--						 AND (@departmentcodep IS NULL OR departmentcodep = @departmentcodep OR @departmentcodep = 0)
--						 AND (@idclientbranchp IS NULL OR idclientbranchp = @idclientbranchp OR @idclientbranchp = 0)
--						 order by lname,fname asc;

SELECT      sum(#TempTablePAG.contributionpagEE) as contributionpagee, 
			sum(#TempTablePAG.contributionpagER) as contributionpager , 
			sum(#TempTablePAG.grossamttaxable) as grosstaxableamt,
			sum(#TempTablePAG.lastbasic) as lastbasic1,
			#TempTablePAG.Employee_id,#TempTablePAG.fname,#TempTablePAG.lname,#TempTablePAG.mname,#TempTablePAG.monthyear,#TempTablePAG.basisofsssded,#TempTablePAG.idclient,#TempTablePAG.departmentcodep,#TempTablePAG.monthyear,companyname, Department.Department_desc,client_branch.branch,#TempTablePAG.pagibigno,birthdate
FROM            #TempTablePAG 
                         INNER JOIN client ON #TempTablePAG.idclientp = client.idclient
						 INNER JOIN Department ON #TempTablePAG.departmentcodep = Department.iddepartment
						 INNER JOIN client_branch ON #TempTablePAG.idclientbranchp = client_branch.idclientbranch						 
						 where  (@idclient = 0 OR idclientp = @idclient)
						 AND (@departmentcodep IS NULL OR departmentcodep = @departmentcodep OR @departmentcodep = 0)
						 AND (@idclientbranchp IS NULL OR idclientbranchp = @idclientbranchp OR @idclientbranchp = 0)
						 
			group by #TempTablePAG.Employee_id, #TempTablePAG.fname,#TempTablePAG.lname,#TempTablePAG.mname,#TempTablePAG.monthyear,#TempTablePAG.basisofsssded,#TempTablePAG.idclient,#TempTablePAG.departmentcodep,#TempTablePAG.monthyear,companyname,Department.Department_desc,client_branch.branch,#TempTablePAG.pagibigno,birthdate
			HAVING (sum(#TempTablePAG.contributionpagEE) <> 0)
			order by lname,fname asc;



--select empid from #TempTable3 where departmentgroup = 'KRR_ Bacoor Junction'
--group by empid

-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTablePAG;


END

